import mongoose from 'mongoose';

const paymentLogSchema = new mongoose.Schema({
    id: String,
    eventType: String,
    data: mongoose.Schema.Types.Mixed,
    timestamp: Date,
}, { collection: 'paymentlogs' }); // explicitly set exact lowercase collection name

export const PaymentLog = mongoose.models.PaymentLog
    || mongoose.model('PaymentLog', paymentLogSchema);

export default PaymentLog;
