import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

/** M0 Atlas allows ~500 connections total — keep pools small (especially on Vercel). */
const MONGO_OPTIONS = {
    maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE || '5', 10),
    minPoolSize: 0,
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
};

// Reuse one pool per serverless instance (Vercel) or per Node process (DO/local).
let cached = global.mongoose;
if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
    const mongoURI = process.env.MONGO_URI_NEW || process.env.MONGO_URI;
    if (!mongoURI) {
        throw new Error('Please define MONGO_URI_NEW or MONGO_URI in .env');
    }

    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        cached.promise = mongoose
            .connect(mongoURI, MONGO_OPTIONS)
            .then((conn) => {
                console.log(`MongoDB Connected: ${conn.connection.host} (pool max ${MONGO_OPTIONS.maxPoolSize})`);
                mongoose.connection.on('error', (err) => {
                    console.error('MongoDB connection error:', err);
                });
                mongoose.connection.on('disconnected', () => {
                    console.log('MongoDB disconnected');
                    cached.conn = null;
                    cached.promise = null;
                });
                return conn;
            })
            .catch((error) => {
                cached.promise = null;
                console.error(`MongoDB connection error: ${error.message}`);
                throw error;
            });
    }

    cached.conn = await cached.promise;
    return cached.conn;
};

export default connectDB;
