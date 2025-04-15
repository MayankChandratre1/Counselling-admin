import { db } from '../../config/firebase.js';

// Size limits in bytes (0.5MB = 524288 bytes)
const MAX_SIZE = 524288;

const truncateData = (data) => {
    if (!data) return null;
    
    const stringified = JSON.stringify(data);
    if (stringified.length <= MAX_SIZE) return data;

    // For arrays, limit to first 10 items
    if (Array.isArray(data)) {
        return {
            _truncated: true,
            originalLength: data.length,
            data: data.slice(0, 10)
        };
    }

    // For objects, include only keys and size info
    if (typeof data === 'object') {
        return {
            _truncated: true,
            originalSize: stringified.length,
            keys: Object.keys(data)
        };
    }

    // For strings, truncate with ellipsis
    return {
        _truncated: true,
        originalSize: stringified.length,
        preview: stringified.substring(0, 100) + '...'
    };
};

const logActivity = async (req, res, next) => {
    const originalSend = res.json;

    res.json = function(data) {
        try {
            const adminId = req.admin?.id;
            const adminEmail = req.admin?.email;
            
            if (adminId) {
                const activity = {
                    adminId,
                    adminEmail,
                    method: req.method,
                    path: req.originalUrl,
                    params: req.params,
                    query: req.query,
                    body: req.method !== 'GET' ? truncateData(req.body) : null,
                    timestamp: new Date().toISOString(),
                    status: res.statusCode,
                    response: req.method !== 'GET' ? truncateData(data) : null
                };

                db.collection('admin_activities')
                    .doc(adminId)
                    .collection('logs')
                    .add(activity)
                    .catch(err => console.error('Activity logging failed:', err));
            }
        } catch (error) {
            console.error('Activity logging error:', error);
        }

        return originalSend.call(this, data);
    };

    next();
};

export default logActivity;
