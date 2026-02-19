import cache from '../config/cache.js';
import crypto from 'crypto';

const cacheMiddleware = (keyPrefix, expireTime = 3600) => {
    return (req, res, next) => {
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

            const cachedData = cache.get(key);
            console.log('Cache result:', cachedData ? 'HIT' : 'MISS');

            if (cachedData) {
                // node-cache stores the object directly, so we just return it
                // unless we stringified it before storing. Let's assume we store objects.
                return res.json(JSON.parse(cachedData));
            }

            const originalSend = res.json;

            res.json = function (data) {
                console.log('Caching for URL:', req.originalUrl);
                cache.set(key, JSON.stringify(data), expireTime);
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
