import express from 'express';
import AdminController from '../controllers/admin.controller.js';
import authMiddleware from '../middleware/authMiddleware.js';
import authorize from '../middleware/authorizeMiddleware.js';
import cacheMiddleware from '../middleware/cacheMiddleware.js';
import logActivity from '../middleware/logActivityMiddleware.js';
import Razorpay from 'razorpay';
import { readFileSync } from 'fs';
import path from 'path';

const router = express.Router();

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZ_KEY_ID,
  key_secret: process.env.RAZ_KEY_SECRET,
});

// Read users data utility
function readUsersData() {
    try {
        const filePath = path.join(__dirname, '..', 'data', 'users.json');
        const data = readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading users.json:', error);
        return [];
    }
}

// Get pending orders from users.json (users with no completed orders)
function getPendingOrdersFromUsers() {
    const users = readUsersData();
    const pendingOrders = [];

    users.forEach(user => {
        if (!user.name || user.name.includes("Demo") || user.name.includes("Mayank")) {
            return;
        }

        if (user.orders && Array.isArray(user.orders)) {
            const hasCompletedOrders = user.orders.some(order => 
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

// Middleware to validate Razorpay credentials
const validateRazorpayConfig = (req, res, next) => {
  if (!process.env.RAZ_KEY_ID || !process.env.RAZ_KEY_SECRET) {
    return res.status(500).json({
      success: false,
      error: 'Razorpay credentials not configured'
    });
  }
  next();
};

// Apply activity logging after authentication
router.use(logActivity);

router.post('/refresh', (req, res)=>{
    res.status(200).json({
        message: 'Refresh endpoint hit successfully',
        timestamp: new Date().toISOString()
    });
});

// Get pending orders from local data
router.get('/pending-orders', (req, res) => {
  try {
    const pendingOrders = getPendingOrdersFromUsers();
    
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
});

// Sync pending orders with Razorpay status
router.post('/sync-pending-orders', validateRazorpayConfig, async (req, res) => {
  try {
    const pendingOrders = getPendingOrdersFromUsers();
    const orderIds = pendingOrders.map(order => order.orderId);
    
    if (orderIds.length === 0) {
      return res.json({
        success: true,
        message: 'No pending orders found',
        data: { orders: [], summary: { total: 0 } }
      });
    }

    const results = [];
    const errors = [];

    // Process orders in batches
    const batchSize = 10;
    for (let i = 0; i < orderIds.length; i += batchSize) {
      const batch = orderIds.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (orderId) => {
        try {
          const razorpayOrder = await razorpay.orders.fetch(orderId);
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

    // Categorize by Razorpay status
    const statusSummary = {
      created: results.filter(order => order.razorpay_status === 'created').length,
      attempted: results.filter(order => order.razorpay_status === 'attempted').length,
      paid: results.filter(order => order.razorpay_status === 'paid').length,
      cancelled: results.filter(order => order.razorpay_status === 'cancelled').length
    };

    res.json({
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
    });

  } catch (error) {
    console.error('Error syncing pending orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync pending orders',
      details: error.message
    });
  }
});

// Get single order status
router.get('/order/:orderId/status', validateRazorpayConfig, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'Order ID is required'
      });
    }

    const order = await razorpay.orders.fetch(orderId);
    
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

  } catch (error) {
    console.error('Error fetching order status:', error);
    
    if (error.statusCode === 400) {
      return res.status(400).json({
        success: false,
        error: 'Invalid order ID'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order status',
      details: error.message
    });
  }
});

// Bulk refresh pending orders
router.post('/orders/refresh', validateRazorpayConfig, async (req, res) => {
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

    const results = [];
    const errors = [];

    const batchSize = 10;
    for (let i = 0; i < orderIds.length; i += batchSize) {
      const batch = orderIds.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (orderId) => {
        try {
          const order = await razorpay.orders.fetch(orderId);
          return {
            id: order.id,
            status: order.status,
            amount: order.amount,
            currency: order.currency,
            created_at: order.created_at,
            receipt: order.receipt,
            attempts: order.attempts,
            orderBy: order.notes
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

    res.json({
      success: true,
      data: {
        orders: results,
        summary: {
          total_requested: orderIds.length,
          successful_fetches: results.length,
          errors: errors.length,
          status_breakdown: statusSummary
        },
        errors: errors
      }
    });

  } catch (error) {
    console.error('Error in bulk refresh:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh orders',
      details: error.message
    });
  }
});

// Get all orders with pagination and status filter
router.get('/orders', validateRazorpayConfig, async (req, res) => {
  try {
    const {
      count = 10,
      skip = 0,
      from,
      to,
      status
    } = req.query;

    const options = {
      count: Math.min(parseInt(count), 100),
      skip: parseInt(skip)
    };

    if (from) options.from = new Date(from).getTime() / 1000;
    if (to) options.to = new Date(to).getTime() / 1000;

    const orders = await razorpay.orders.all(options);
    
    let filteredOrders = orders.items;
    
    if (status) {
      filteredOrders = orders.items.filter(order => order.status === status);
    }

    const statusCounts = orders.items.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {});

    res.json({
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
    });

  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders',
      details: error.message
    });
  }
});

// Get payments for an order
router.get('/order/:orderId/payments', validateRazorpayConfig, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const payments = await razorpay.orders.fetchPayments(orderId);
    
    res.json({
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
    });

  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payments for order',
      details: error.message
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Razorpay Order API is running',
    timestamp: new Date().toISOString(),
    config: {
      key_id_configured: !!process.env.RAZ_KEY_ID,
      key_secret_configured: !!process.env.RAZ_KEY_SECRET
    }
  });
});

export default router;
