import PaymentLog from '../models/paymentLog.model.js';

/**
 * PaymentService
 * Reads from the `paymentLogs` collection.
 *
 * PaymentLog schema: { id, eventType, data: Mixed, timestamp }
 *
 * The `data` field contains the raw Razorpay webhook payload which has
 * varying shapes depending on eventType. The frontend handles display logic.
 *
 * Search helpers flatten into data to find order IDs / payment IDs / phone
 * numbers wherever they appear inside the nested Razorpay payload.
 */
class PaymentService {

    /**
     * Paginated list of all payment logs, newest first.
     * Supports optional filters: fromDate, toDate, plan, status.
     */
    async getPayments(lastdoc, limit = 10, page = 1, filters = {}) {
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, parseInt(limit) || 10);

        const query = {};

        // Date range filter on the top-level timestamp field
        if (filters.fromDate || filters.toDate) {
            query.timestamp = {};
            if (filters.fromDate) query.timestamp.$gte = new Date(filters.fromDate);
            if (filters.toDate) query.timestamp.$lte = new Date(filters.toDate + 'T23:59:59.999Z');
        }

        // Status filter — search inside data.payment.status, data.status, data.order.status
        if (filters.status) {
            const statusRegex = new RegExp(filters.status, 'i');
            query.$or = [
                { 'data.status': statusRegex },
                { 'data.payment.status': statusRegex },
                { 'data.order.status': statusRegex },
            ];
        }

        const skip = (pageNum - 1) * limitNum;

        const logs = await PaymentLog
            .find(query)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean();

        return logs;
    }

    /**
     * Search payment logs by phone number.
     * Phone is stored at data.contact, data.payment.contact, or data.order.notes.userPhone.
     */
    async getUserPayment(phone) {
        if (!phone) throw new Error('Phone number is required');

        // Strip non-digits; match last 10 digits
        const digits = phone.replace(/\D/g, '').slice(-10);
        const phoneRegex = new RegExp(digits + '$');

        const logs = await PaymentLog.find({
            $or: [
                { 'data.contact': phoneRegex },
                { 'data.payment.contact': phoneRegex },
                { 'data.order.notes.userPhone': phoneRegex },
            ]
        }).sort({ timestamp: -1 }).lean();

        return logs;
    }

    /**
     * Search payment logs by Razorpay order ID.
     * Order IDs appear in multiple places depending on event type.
     */
    async getPaymentsByOrderId(orderId) {
        if (!orderId) throw new Error('Order ID is required');

        const logs = await PaymentLog.find({
            $or: [
                { 'data.id': orderId },   // order event: data IS the order
                { 'data.order.id': orderId },   // nested order.paid: data.order
                { 'data.order_id': orderId },   // payment event: data.order_id
                { 'data.payment.order_id': orderId },   // nested payment.order_id
            ]
        }).sort({ timestamp: -1 }).lean();

        return logs;
    }

    /**
     * Search payment logs by Razorpay payment ID.
     */
    async getPaymentsByPaymentId(paymentId) {
        if (!paymentId) throw new Error('Payment ID is required');

        const logs = await PaymentLog.find({
            $or: [
                { 'data.id': paymentId },   // payment event: data IS the payment
                { 'data.payment.id': paymentId },   // nested order.paid: data.payment.id
            ]
        }).sort({ timestamp: -1 }).lean();

        return logs;
    }
}

export default new PaymentService();
