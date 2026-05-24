import AdminMongoService from '../services/admin.mongo.service.js';

const logActivity = async (req, res, next) => {
    if (req.method === 'GET') {
        return next();
    }

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
                    path: req.originalUrl.split('?')[0],
                    timestamp: new Date()
                };

                // Log to MongoDB asynchronously (don't await, don't block response)
                AdminMongoService.logActivity(activity)
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
