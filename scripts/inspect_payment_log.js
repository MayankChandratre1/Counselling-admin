import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const PaymentLog = mongoose.model('PL', new mongoose.Schema({}, { strict: false, collection: 'paymentlogs' }));

async function main() {
    await mongoose.connect(process.env.MONGO_URI_NEW || process.env.MONGO_URI);
    const log = await PaymentLog.findOne({ id: 'plog_pay_T51PA4SdiJyW2Q_payment.captured' }).lean();
    console.log(JSON.stringify(log?.data, null, 2));
    await mongoose.disconnect();
}

main();
