import RazorpayService from '../services/raz.service.js';

class RazorpayController {
    constructor() {
        this.razorpayService = new RazorpayService();
    }

    // Health check
    health = (req, res) => {
        res.json({
            success: true,
            message: 'Razorpay Order API is running',
            timestamp: new Date().toISOString(),
            config: {
                key_id_configured: !!process.env.RAZ_KEY_ID,
                key_secret_configured: !!process.env.RAZ_KEY_SECRET
            }
        });
    };

    // Get pending orders
    getPendingOrders = (req, res) => {
        try {
            const pendingOrders = this.razorpayService.getPendingOrdersFromUsers();
            
            res.json({
                success: true,
                data: {
                    orders: pendingOrders,
                    summary: {
                        total_pending: pendingOrders.length,
                        total_amount: pendingOrders.reduce((sum, order) => sum + (order.amount || 0), 0)
                    }
                }
            });

        } catch (error) {
            console.error('Error fetching pending orders:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch pending orders',
                details: error.message
            });
        }
    };

    // Sync pending orders
    syncPendingOrders = async (req, res) => {
        try {
            const result = await this.razorpayService.syncPendingOrders();
            
            if (result.success) {
                res.json(result);
            } else {
                res.status(500).json(result);
            }

        } catch (error) {
            console.error('Error syncing pending orders:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to sync pending orders',
                details: error.message
            });
        }
    };

    // Get single order status
    getOrderStatus = async (req, res) => {
        try {
            const { orderId } = req.params;
            
            if (!orderId) {
                return res.status(400).json({
                    success: false,
                    error: 'Order ID is required'
                });
            }

            const result = await this.razorpayService.fetchOrder(orderId);
            
            if (result.success) {
                const order = result.data;
                console.log(`Order fetched: ${order.id}, Status: ${order.status}`);
                
                res.json({
                    success: true,
                    data: {
                        id: order.id,
                        status: order.status,
                        amount: order.amount,
                        currency: order.currency,
                        created_at: order.created_at,
                        receipt: order.receipt,
                        notes: order.notes,
                        attempts: order.attempts
                    }
                });
            } else {
                const statusCode = result.error.includes('Invalid') ? 400 : 500;
                res.status(statusCode).json({
                    success: false,
                    error: 'Failed to fetch order status',
                    details: result.error
                });
            }

        } catch (error) {
            console.error('Error fetching order status:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch order status',
                details: error.message
            });
        }
    };

    // Bulk refresh orders with paid order handling
    refreshOrders = async (req, res) => {
        try {
            const { orderIds } = req.body;
            
            if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Array of order IDs is required'
                });
            }

            if (orderIds.length > 50) {
                return res.status(400).json({
                    success: false,
                    error: 'Maximum 50 orders can be checked at once'
                });
            }

            const result = await this.razorpayService.bulkRefreshOrders(orderIds);
            
            if (result.success) {
                console.log(`Bulk refresh completed for ${result.data.length} orders`);
                
                res.json(result);
            } else {
                res.status(500).json(result);
            }

        } catch (error) {
            console.error('Error in bulk refresh:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to refresh orders',
                details: error.message
            });
        }
    };

    // Get all orders
    getAllOrders = async (req, res) => {
        try {
            const options = {
                count: req.query.count || 10,
                skip: req.query.skip || 0,
                from: req.query.from,
                to: req.query.to,
                status: req.query.status
            };

            const result = await this.razorpayService.fetchAllOrders(options);
            
            if (result.success) {
                res.json(result);
            } else {
                res.status(500).json(result);
            }

        } catch (error) {
            console.error('Error fetching orders:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch orders',
                details: error.message
            });
        }
    };

    // Get payments for an order
    getOrderPayments = async (req, res) => {
        try {
            const { orderId } = req.params;
            
            const result = await this.razorpayService.fetchOrderPayments(orderId);
            
            if (result.success) {
                res.json(result);
            } else {
                res.status(500).json(result);
            }

        } catch (error) {
            console.error('Error fetching payments:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch payments for order',
                details: error.message
            });
        }
    };

    // Simple refresh endpoint
    refresh = (req, res) => {
        res.status(200).json({
            message: 'Refresh endpoint hit successfully',
            timestamp: new Date().toISOString()
        });
    };
}

export default RazorpayController;