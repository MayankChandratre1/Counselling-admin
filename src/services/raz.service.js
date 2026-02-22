import Razorpay from 'razorpay';
import { User } from '../models/user.model.js';
import UserService from './user.service.js';

/**
 * RazorpayService — fixed version.
 *
 * Bugs fixed vs the old raz.service.js:
 *  1. readUsersData() read from a JSON file (stale). Now queries MongoDB directly.
 *  2. handleOrderCancelled() referenced undefined `planData`. Now properly omits planData
 *     on cancellations (only orderData is updated).
 *  3. getPendingOrdersFromUsers() now queries DB instead of JSON file.
 */
class RazorpayService {
    constructor() {
        this.razorpay = new Razorpay({
            key_id: process.env.RAZ_KEY_ID,
            key_secret: process.env.RAZ_KEY_SECRET,
        });
    }

    // ── Pending Orders (from MongoDB) ─────────────────────────────────────────

    /**
     * Get all pending orders from users in MongoDB.
     * Fixed: was reading from users.json — now queries DB.
     */
    async getPendingOrdersFromUsers() {
        try {
            // Exclude demo/test users
            const users = await User.find({
                name: { $not: /Demo|Mayank/i },
                'orders.0': { $exists: true }
            }).lean();

            const pendingOrders = [];

            users.forEach(user => {
                const hasCompleted = user.isPremium ||
                    (user.orders || []).some(o => o.paymentStatus === 'completed');

                if (!hasCompleted) {
                    (user.orders || []).forEach(order => {
                        if (order.paymentStatus === 'pending') {
                            pendingOrders.push({
                                orderId: order.orderId,
                                phone: user.phone,
                                name: user.name || 'N/A',
                                amount: order.amount,
                                currency: order.currency || 'INR',
                                customerPlan: order.notes?.customerPlan || 'N/A',
                                createdAt: order.createdAt,
                                userId: user.id
                            });
                        }
                    });
                }
            });

            return pendingOrders;
        } catch (error) {
            console.error('Error fetching pending orders from DB:', error);
            return [];
        }
    }

    // ── Order Handlers ────────────────────────────────────────────────────────

    /**
     * Handle a paid order — update user premium plan.
     * Delegates to UserService.updateUserWithOrderId.
     */
    async handleOrderPaid(order) {
        try {
            console.log('Processing paid order:', order.id);

            const { notes } = order;
            const userPhone = notes?.userPhone;

            if (!userPhone) {
                console.error('No user phone found in order notes:', order.id);
                return { success: false, error: 'No user phone found' };
            }

            // Parse plan details
            let planDetails = {};
            try {
                if (notes.planDetails) planDetails = JSON.parse(notes.planDetails);
            } catch {
                planDetails = { plan: notes.customerPlan || 'Unknown', isPremium: true };
            }

            const planData = {
                plan: planDetails.plan || notes.customerPlan || 'Unknown',
                isPremium: true,
                price: planDetails.price || '0',
                expiry: planDetails.expiry || 60,
                expiryDate: planDetails.expiryDate || new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000),
                form: planDetails.form || 'Unknown',
                planTitle: notes.planTitle || notes.customerPlan
            };

            const orderData = {
                orderId: order.id,
                amount: order.amount,
                currency: order.currency,
                status: order.status,
                receipt: order.receipt,
                created_at: order.created_at,
                amount_paid: order.amount_paid,
                amount_due: order.amount_due,
                attempts: order.attempts
            };

            console.log('User update payload for order:', order.id, { planData, orderData });

            const updateResult = await UserService.updateUserWithOrderId(order.id, planData, orderData);
            console.log('User update result for order:', order.id, updateResult);

            return { success: true, orderId: order.id, userPhone, planData, orderData, updateResult };
        } catch (error) {
            console.error('Error handling paid order:', order.id, error);
            return { success: false, error: error.message, orderId: order.id };
        }
    }

    /**
     * Handle a cancelled order — update order status (no plan change).
     * Fixed: old version used undefined `planData` — now planData is omitted.
     */
    async handleOrderCancelled(order) {
        try {
            console.log('Processing cancelled order:', order.id);

            const { notes } = order;
            const userPhone = notes?.userPhone;

            if (!userPhone) {
                console.error('No user phone found in order notes:', order.id);
                return { success: false, error: 'No user phone found' };
            }

            const orderData = {
                orderId: order.id,
                amount: order.amount,
                currency: order.currency,
                status: order.status,
                receipt: order.receipt,
                created_at: order.created_at,
                amount_paid: order.amount_paid,
                amount_due: order.amount_due,
                attempts: order.attempts
            };

            // Pass null for planData — cancelled orders don't upgrade the user
            const updateResult = await UserService.updateUserWithOrderId(order.id, null, orderData);
            console.log('Cancelled order update result:', order.id, updateResult);

            return { success: true, orderId: order.id, userPhone, orderData, updateResult };
        } catch (error) {
            console.error('Error handling cancelled order:', order.id, error);
            return { success: false, error: error.message, orderId: order.id };
        }
    }

    // ── Razorpay API Wrappers ─────────────────────────────────────────────────

    async fetchOrder(orderId) {
        try {
            const order = await this.razorpay.orders.fetch(orderId);
            return { success: true, data: order };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async bulkRefreshOrders(orderIds) {
        try {
            if (!Array.isArray(orderIds) || orderIds.length === 0) {
                throw new Error('Array of order IDs is required');
            }
            if (orderIds.length > 50) {
                throw new Error('Maximum 50 orders can be checked at once');
            }

            const results = [];
            const errors = [];
            const paidOrderResults = [];
            const batchSize = 10;

            for (let i = 0; i < orderIds.length; i += batchSize) {
                const batch = orderIds.slice(i, i + batchSize);

                const batchResults = await Promise.all(batch.map(async (orderId) => {
                    try {
                        const order = await this.razorpay.orders.fetch(orderId);
                        if (order.status === 'paid') {
                            paidOrderResults.push(await this.handleOrderPaid(order));
                        }
                        if (order.status === 'cancelled') {
                            paidOrderResults.push(await this.handleOrderCancelled(order));
                        }
                        return {
                            id: order.id, status: order.status, amount: order.amount,
                            currency: order.currency, created_at: order.created_at,
                            receipt: order.receipt, attempts: order.attempts,
                            amount_paid: order.amount_paid, amount_due: order.amount_due,
                            orderBy: order.notes, wasPaid: order.status === 'paid'
                        };
                    } catch (err) {
                        errors.push({ orderId, error: err.message });
                        return null;
                    }
                }));

                results.push(...batchResults.filter(Boolean));
                if (i + batchSize < orderIds.length) {
                    await new Promise(r => setTimeout(r, 100));
                }
            }

            const statusSummary = {
                created: results.filter(o => o.status === 'created').length,
                attempted: results.filter(o => o.status === 'attempted').length,
                paid: results.filter(o => o.status === 'paid').length,
                cancelled: results.filter(o => o.status === 'cancelled').length
            };

            return {
                success: true,
                data: {
                    orders: results,
                    summary: {
                        total_requested: orderIds.length,
                        successful_fetches: results.length,
                        errors: errors.length,
                        status_breakdown: statusSummary,
                        paid_orders_processed: paidOrderResults.length
                    },
                    errors,
                    paidOrderResults
                }
            };
        } catch (error) {
            console.error('Error in bulk refresh:', error);
            return { success: false, error: error.message };
        }
    }

    async syncPendingOrders() {
        try {
            const pendingOrders = await this.getPendingOrdersFromUsers(); // Fixed: async now
            const orderIds = pendingOrders.map(o => o.orderId);

            if (orderIds.length === 0) {
                return {
                    success: true,
                    message: 'No pending orders found',
                    data: { orders: [], summary: { total: 0 } }
                };
            }

            const results = [];
            const errors = [];
            const batchSize = 10;

            for (let i = 0; i < orderIds.length; i += batchSize) {
                const batch = orderIds.slice(i, i + batchSize);

                const batchResults = await Promise.all(batch.map(async (orderId) => {
                    try {
                        const razorpayOrder = await this.razorpay.orders.fetch(orderId);
                        const localOrder = pendingOrders.find(o => o.orderId === orderId);
                        return {
                            ...localOrder,
                            razorpay_status: razorpayOrder.status,
                            razorpay_amount: razorpayOrder.amount,
                            attempts: razorpayOrder.attempts,
                            status_changed: localOrder?.paymentStatus !== razorpayOrder.status
                        };
                    } catch (err) {
                        const localOrder = pendingOrders.find(o => o.orderId === orderId);
                        errors.push({ orderId, localOrder, error: err.message });
                        return null;
                    }
                }));

                results.push(...batchResults.filter(Boolean));
                if (i + batchSize < orderIds.length) {
                    await new Promise(r => setTimeout(r, 100));
                }
            }

            const statusSummary = {
                created: results.filter(o => o.razorpay_status === 'created').length,
                attempted: results.filter(o => o.razorpay_status === 'attempted').length,
                paid: results.filter(o => o.razorpay_status === 'paid').length,
                cancelled: results.filter(o => o.razorpay_status === 'cancelled').length
            };

            return {
                success: true,
                data: {
                    orders: results,
                    summary: {
                        total_local_pending: pendingOrders.length,
                        successful_syncs: results.length,
                        errors: errors.length,
                        razorpay_status_breakdown: statusSummary,
                        status_mismatches: results.filter(o => o.status_changed).length
                    },
                    errors
                }
            };
        } catch (error) {
            console.error('Error syncing pending orders:', error);
            return { success: false, error: error.message };
        }
    }

    async fetchAllOrders(options = {}) {
        try {
            const { count = 10, skip = 0, from, to, status } = options;
            const queryOptions = {
                count: Math.min(parseInt(count), 100),
                skip: parseInt(skip)
            };
            if (from) queryOptions.from = new Date(from).getTime() / 1000;
            if (to) queryOptions.to = new Date(to).getTime() / 1000;

            const orders = await this.razorpay.orders.all(queryOptions);
            let filteredOrders = orders.items;
            if (status) filteredOrders = orders.items.filter(o => o.status === status);

            const statusCounts = orders.items.reduce((acc, o) => {
                acc[o.status] = (acc[o.status] || 0) + 1;
                return acc;
            }, {});

            return {
                success: true,
                data: {
                    orders: filteredOrders.map(o => ({
                        id: o.id, status: o.status, amount: o.amount,
                        currency: o.currency, created_at: o.created_at,
                        receipt: o.receipt, attempts: o.attempts
                    })),
                    pagination: {
                        count: filteredOrders.length,
                        total_available: orders.items.length,
                        skip: parseInt(skip),
                        has_more: orders.count > (parseInt(skip) + parseInt(count))
                    },
                    status_summary: statusCounts
                }
            };
        } catch (error) {
            console.error('Error fetching orders:', error);
            return { success: false, error: error.message };
        }
    }

    async fetchOrderPayments(orderId) {
        try {
            const payments = await this.razorpay.orders.fetchPayments(orderId);
            return {
                success: true,
                data: {
                    order_id: orderId,
                    payments: payments.items.map(p => ({
                        id: p.id, status: p.status, amount: p.amount,
                        method: p.method, created_at: p.created_at,
                        error_code: p.error_code, error_description: p.error_description
                    }))
                }
            };
        } catch (error) {
            console.error('Error fetching payments:', error);
            return { success: false, error: error.message };
        }
    }
}

export default RazorpayService;