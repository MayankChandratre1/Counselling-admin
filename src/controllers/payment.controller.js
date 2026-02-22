import PaymentService from '../services/payment.service.js';

const PaymentController = {
    async getPayments(req, res) {
        try {
            const { lastdoc, limit, page, ...filters } = req.query;
            const result = await PaymentService.getPayments(lastdoc, limit, page, filters);
            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async getUserPayment(req, res) {
        try {
            const result = await PaymentService.getUserPayment(req.params.phone);
            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async getPaymentsByOrderId(req, res) {
        try {
            const result = await PaymentService.getPaymentsByOrderId(req.params.orderId);
            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async getPaymentsByPaymentId(req, res) {
        try {
            const result = await PaymentService.getPaymentsByPaymentId(req.params.paymentId);
            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
};

export default PaymentController;
