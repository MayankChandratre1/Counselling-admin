import express from 'express';
import RazorpayController from '../controllers/raz.controller.js';
import authMiddleware from '../middleware/authMiddleware.js';
import authorize from '../middleware/authorizeMiddleware.js';
import logActivity from '../middleware/logActivityMiddleware.js';

const router = express.Router();

// Initialize controller
const razorpayController = new RazorpayController();

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

// Routes
router.post('/refresh', razorpayController.refresh);
router.get('/pending-orders', razorpayController.getPendingOrders);
router.post('/sync-pending-orders', validateRazorpayConfig, razorpayController.syncPendingOrders);
router.get('/order/:orderId/status', validateRazorpayConfig, razorpayController.getOrderStatus);
router.post('/orders/refresh', validateRazorpayConfig, razorpayController.refreshOrders);
router.get('/orders', validateRazorpayConfig, razorpayController.getAllOrders);
router.get('/order/:orderId/payments', validateRazorpayConfig, razorpayController.getOrderPayments);
router.get('/health', razorpayController.health);

export default router;
