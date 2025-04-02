import redis from '../config/redisClient.js';

const cacheMiddleware = (keyPrefix, expireTime = 3600) => {
    return async (req, res, next) => {
        try {
            const key = `${keyPrefix}:${req.originalUrl}`;
            const cachedData = await redis.get(key);
            console.log('cachedData found for:', req.originalUrl);
            
            if (cachedData) {
                return res.json(JSON.parse(cachedData));
            }

            // Store original send function
            const originalSend = res.json;

            // Override res.json method
            res.json = function(data) {
                // Store in Redis before sending response
                redis.setex(key, expireTime, JSON.stringify(data));
                
                // Call original method
                return originalSend.call(this, data);
            };

            next();
        } catch (error) {
            console.error('Cache middleware error:', error);
            next();
        }
    };
};

export default cacheMiddleware;
