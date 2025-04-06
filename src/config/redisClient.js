// filepath: e:\counselling\Backend\College_api\config\redisClient.js
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) :new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || ''
});

redis.on('error', (err) => {
  console.error('Redis error:', err);
});

export default redis;