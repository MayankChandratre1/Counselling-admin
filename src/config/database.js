import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env if not already loaded (though usually loaded in app.js)
dotenv.config({ path: path.join(__dirname, '../../.env') });

const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGO_URI_NEW || process.env.MONGO_URI;

        if (!mongoURI) {
            throw new Error('Please define MONGO_URI_NEW in .env');
        }

        const conn = await mongoose.connect(mongoURI, {
            // New Mongoose versions don't need these options, but keeping for safety if old version
            // useNewUrlParser: true,
            // useUnifiedTopology: true,
        });

        console.log(`MongoDB Connected: ${conn.connection.host}`);

        // Handle events
        mongoose.connection.on('error', err => {
            console.error('MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB disconnected');
        });

    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

export default connectDB;
