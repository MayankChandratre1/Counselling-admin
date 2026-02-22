
import mongoose from 'mongoose';
import { CounsellingForm } from './src/models/forms.model.js';
import connectDB from './src/config/database.js';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    await connectDB();
    const count = await CounsellingForm.countDocuments();
    console.log(`CounsellingForm count: ${count}`);
    if (count > 0) {
        const docs = await CounsellingForm.find({});
        console.log(JSON.stringify(docs, null, 2));
    }
    process.exit();
};

run();
