import Razorpay from 'razorpay';
import AdminService from './admin.service.js';
import { readFileSync } from 'fs';
import path from 'path';

class RazorpayService {
    constructor() {
        this.razorpay = new Razorpay({
            key_id: process.env.RAZ_KEY_ID,
            key_secret: process.env.RAZ_KEY_SECRET,
        });
        this.adminService = new AdminService();
    }

    // Read users data utility
    readUsersData() {
        try {
            const filePath = path.join(process.cwd(), 'src', 'data', 'users.json');
            const data = readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error reading users.json:', error);
            return [];
        }
    }

    // Get pending orders from users.json
    getPendingOrdersFromUsers() {
        const users = this.readUsersData();
        const pendingOrders = [];

        users.forEach(user => {
            if (!user.name || user.name.includes("Demo") || user.name.includes("Mayank")) {
                return;
            }

            if (user.orders && Array.isArray(user.orders)) {
                let hasCompletedOrders = user.isPremium; 

                if(!hasCompletedOrders)
                hasCompletedOrders = user.orders.some(order => 
                    order.paymentStatus === 'completed'
                );
                
                if (!hasCompletedOrders) {
                    user.orders.forEach(order => {
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
            }
        });

        return pendingOrders;
    }

    // Handle order paid logic
    async handleOrderPaid(order ) {
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
                if (notes.planDetails) {
                    planDetails = JSON.parse(notes.planDetails);
                }
            } catch (error) {
                console.error('Error parsing plan details:', error);
                planDetails = {
                    plan: notes.customerPlan || 'Unknown',
                    isPremium: true
                };
            }

            // Prepare plan data
            const planData = {
                plan: planDetails.plan || notes.customerPlan || 'Unknown',
                isPremium: planDetails.isPremium || true,
                price: planDetails.price || '0',
                expiry: planDetails.expiry || 60,
                expiryDate: planDetails.expiryDate || new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000),
                form: planDetails.form || 'Unknown',
                planTitle: notes.planTitle || notes.customerPlan
            };

            // Prepare order data
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
             console.log('User update payload for order:', order.id, {planData, orderData});

            // Update user with order data
            const updateResult = await this.adminService.updateUserWithOrderId(
                order.id, 
                planData, 
                orderData
            );

            console.log('User update result for order:', order.id, updateResult);

            return {
                success: true,
                orderId: order.id,
                userPhone: userPhone,
                planData: planData,
                orderData: orderData,
                updateResult: updateResult
            };

        } catch (error) {
            console.error('Error handling paid order:', order.id, error);
            return {
                success: false,
                error: error.message,
                orderId: order.id
            };
        }
    }

    async handleOrderCancelled(order ) {
        try {
            console.log('Processing paid order:', order.id);
            
            const { notes } = order;
            const userPhone = notes?.userPhone;
            
            if (!userPhone) {
                console.error('No user phone found in order notes:', order.id);
                return { success: false, error: 'No user phone found' };
            }


            // Prepare order data
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
             console.log('User update payload for order:', order.id, {orderData});

            // Update user with order data
            const updateResult = await this.adminService.updateUserWithOrderId(
                order.id, 
                planData, 
                orderData
            );

            console.log('User update result for order:', order.id, updateResult);

            return {
                success: true,
                orderId: order.id,
                userPhone: userPhone,
                planData: planData,
                orderData: orderData,
                updateResult: updateResult
            };

        } catch (error) {
            console.error('Error handling paid order:', order.id, error);
            return {
                success: false,
                error: error.message,
                orderId: order.id
            };
        }
    }

    // Fetch single order from Razorpay
    async fetchOrder(orderId) {
        try {
            const order = await this.razorpay.orders.fetch(orderId);
            return { success: true, data: order };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Bulk refresh orders with paid order handling
    async bulkRefreshOrders(orderIds) {
        try {
            if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
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
                
                const batchPromises = batch.map(async (orderId) => {
                    try {
                        const order = await this.razorpay.orders.fetch(orderId);
                        console.log(`Refreshing order ${orderId}:`, order);

                        // Handle paid orders
                        if (order.status === 'paid') {
                            const paidResult = await this.handleOrderPaid(order);
                            paidOrderResults.push(paidResult);
                        }
                        if (order.status === 'cancelled') {
                            const paidResult = await this.handleOrderCancelled(order);
                            paidOrderResults.push(paidResult);
                        }

                        return {
                            id: order.id,
                            status: order.status,
                            amount: order.amount,
                            currency: order.currency,
                            created_at: order.created_at,
                            receipt: order.receipt,
                            attempts: order.attempts,
                            amount_paid: order.amount_paid,
                            amount_due: order.amount_due,
                            orderBy: order.notes,
                            wasPaid: order.status === 'paid'
                        };
                    } catch (error) {
                        errors.push({
                            orderId,
                            error: error.message
                        });
                        return null;
                    }
                });

                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults.filter(result => result !== null));
                
                // Add delay between batches
                if (i + batchSize < orderIds.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            const statusSummary = {
                created: results.filter(order => order.status === 'created').length,
                attempted: results.filter(order => order.status === 'attempted').length,
                paid: results.filter(order => order.status === 'paid').length,
                cancelled: results.filter(order => order.status === 'cancelled').length
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
                    errors: errors,
                    paidOrderResults: paidOrderResults
                }
            };

        } catch (error) {
            console.error('Error in bulk refresh:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Sync pending orders with Razorpay
    async syncPendingOrders() {
        try {
            const pendingOrders = this.getPendingOrdersFromUsers();
            const orderIds = pendingOrders.map(order => order.orderId);
            
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
                
                const batchPromises = batch.map(async (orderId) => {
                    try {
                        const razorpayOrder = await this.razorpay.orders.fetch(orderId);
                        const localOrder = pendingOrders.find(order => order.orderId === orderId);
                        
                        return {
                            ...localOrder,
                            razorpay_status: razorpayOrder.status,
                            razorpay_amount: razorpayOrder.amount,
                            attempts: razorpayOrder.attempts,
                            status_changed: localOrder.paymentStatus !== razorpayOrder.status
                        };
                    } catch (error) {
                        const localOrder = pendingOrders.find(order => order.orderId === orderId);
                        errors.push({
                            orderId,
                            localOrder,
                            error: error.message
                        });
                        return null;
                    }
                });

                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults.filter(result => result !== null));
                
                if (i + batchSize < orderIds.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            const statusSummary = {
                created: results.filter(order => order.razorpay_status === 'created').length,
                attempted: results.filter(order => order.razorpay_status === 'attempted').length,
                paid: results.filter(order => order.razorpay_status === 'paid').length,
                cancelled: results.filter(order => order.razorpay_status === 'cancelled').length
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
                        status_mismatches: results.filter(order => order.status_changed).length
                    },
                    errors: errors
                }
            };

        } catch (error) {
            console.error('Error syncing pending orders:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Fetch all orders with filters
    async fetchAllOrders(options = {}) {
        try {
            const {
                count = 10,
                skip = 0,
                from,
                to,
                status
            } = options;

            const queryOptions = {
                count: Math.min(parseInt(count), 100),
                skip: parseInt(skip)
            };

            if (from) queryOptions.from = new Date(from).getTime() / 1000;
            if (to) queryOptions.to = new Date(to).getTime() / 1000;

            const orders = await this.razorpay.orders.all(queryOptions);
            
            let filteredOrders = orders.items;
            
            if (status) {
                filteredOrders = orders.items.filter(order => order.status === status);
            }

            const statusCounts = orders.items.reduce((acc, order) => {
                acc[order.status] = (acc[order.status] || 0) + 1;
                return acc;
            }, {});

            return {
                success: true,
                data: {
                    orders: filteredOrders.map(order => ({
                        id: order.id,
                        status: order.status,
                        amount: order.amount,
                        currency: order.currency,
                        created_at: order.created_at,
                        receipt: order.receipt,
                        attempts: order.attempts
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
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Fetch payments for an order
    async fetchOrderPayments(orderId) {
        try {
            const payments = await this.razorpay.orders.fetchPayments(orderId);
            
            return {
                success: true,
                data: {
                    order_id: orderId,
                    payments: payments.items.map(payment => ({
                        id: payment.id,
                        status: payment.status,
                        amount: payment.amount,
                        method: payment.method,
                        created_at: payment.created_at,
                        error_code: payment.error_code,
                        error_description: payment.error_description
                    }))
                }
            };

        } catch (error) {
            console.error('Error fetching payments:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

export default RazorpayService;