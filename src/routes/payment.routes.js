import express from 'express';
import PaymentController from '../controllers/payment.controller.js';

const router = express.Router();

router.get('/payments', PaymentController.getPayments);
router.get('/payments/phone/:phone', PaymentController.getUserPayment);
router.get('/payments/order-id/:orderId', PaymentController.getPaymentsByOrderId);
router.get('/payments/payment-id/:paymentId', PaymentController.getPaymentsByPaymentId);

export default router;
