import redis from '../config/redisClient.js';

import crypto from 'crypto';

const cacheMiddleware = (keyPrefix, expireTime = 3600) => {
    return async (req, res, next) => {
        try {
            // Create a hash of the full URL with sorted query params
            const sortedQuery = Object.keys(req.query)
                .sort()
                .reduce((result, key) => {
                    result[key] = req.query[key];
                    return result;
                }, {});
            
            const fullUrl = `${req.path}:${JSON.stringify(sortedQuery)}`;
            const hash = crypto.createHash('md5').update(fullUrl).digest('hex');
            const key = `${keyPrefix}:${hash}`;
            
            console.log('URL:', req.originalUrl);
            console.log('Cache key:', key);
            
            const cachedData = await redis.get(key);
            console.log('Cache result:', cachedData ? 'HIT' : 'MISS');
            
            if (cachedData) {
                return res.json(JSON.parse(cachedData));
            }

            const originalSend = res.json;

            res.json = function(data) {
                console.log('Caching for URL:', req.originalUrl);
                redis.setex(key, expireTime, JSON.stringify(data))
                    .catch(err => console.error('Redis error:', err));
                
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
