/**
 * Inspect user + order for premium grant debugging.
 * Usage: node scripts/inspect_user_order.js 9860874871 order_T51JghdljUOQ5Y
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const phone = process.argv[2] || '9860874871';
const orderId = process.argv[3] || 'order_T51JghdljUOQ5Y';

const UserSchema = new mongoose.Schema({}, { strict: false, collection: 'users' });
const PaymentLogSchema = new mongoose.Schema({}, { strict: false, collection: 'paymentlogs' });
const User = mongoose.model('UserInspect', UserSchema);
const PaymentLog = mongoose.model('PaymentLogInspect', PaymentLogSchema);

async function main() {
    const uri = process.env.MONGO_URI_NEW || process.env.MONGO_URI;
    await mongoose.connect(uri);

    const phoneVariants = [phone, `+91${phone}`, `91${phone}`];
    const user = await User.findOne({
        $or: phoneVariants.map((p) => ({ phone: p }))
    }).lean();

    console.log('\n=== USER ===');
    if (!user) {
        console.log('User not found for phone variants:', phoneVariants);
    } else {
        console.log({
            id: user.id,
            name: user.name,
            phone: user.phone,
            isPremium: user.isPremium,
            currentOrderId: user.currentOrderId,
            orderIds: user.orderIds,
            premiumPlan: user.premiumPlan,
        });
        const orders = user.orders || [];
        console.log(`\nOrders (${orders.length}):`);
        orders.forEach((o, i) => {
            console.log(`\n--- order[${i}] ---`);
            console.log({
                orderId: o.orderId,
                paymentStatus: o.paymentStatus,
                status: o.status,
                amount: o.amount,
                createdAt: o.createdAt,
                notes: o.notes,
            });
        });
        const match = orders.find((o) => o.orderId === orderId);
        console.log('\n=== TARGET ORDER ON USER ===');
        console.log(match ? match : 'ORDER NOT FOUND IN user.orders[]');
        console.log('currentOrderId matches target?', user.currentOrderId === orderId);
    }

    console.log('\n=== PAYMENT LOGS FOR ORDER ===');
    const logs = await PaymentLog.find({
        $or: [
            { 'data.order_id': orderId },
            { 'data.id': orderId },
        ],
    })
        .sort({ timestamp: -1 })
        .limit(10)
        .lean();
    if (!logs.length) {
        console.log('No payment logs found (webhook may not have fired or used different id field)');
    } else {
        logs.forEach((l) => {
            console.log({ eventType: l.eventType, timestamp: l.timestamp, id: l.id });
        });
    }

    await mongoose.disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
