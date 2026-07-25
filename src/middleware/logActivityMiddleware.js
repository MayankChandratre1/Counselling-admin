import AdminMongoService from '../services/admin.mongo.service.js';

/** Max path length stored — long list IDs balloon every log row. */
const MAX_PATH_LEN = 120;

const LOGGED = Symbol('adminActivityLogged');

function isActivityLoggingEnabled() {
    const enabled = process.env.ADMIN_ACTIVITY_LOG_ENABLED;
    if (enabled === '0' || enabled === 'false' || enabled === 'no') {
        return false;
    }

    const pauseUntil = process.env.ADMIN_ACTIVITY_LOG_PAUSE_UNTIL;
    if (pauseUntil) {
        const until = new Date(pauseUntil);
        if (!Number.isNaN(until.getTime()) && Date.now() < until.getTime()) {
            return false;
        }
    }

    return true;
}

function truncatePath(path) {
    if (!path || path.length <= MAX_PATH_LEN) return path || '';
    return `${path.slice(0, MAX_PATH_LEN)}…`;
}

const logActivity = async (req, res, next) => {
    if (!isActivityLoggingEnabled()) {
        return next();
    }

    if (req.method === 'GET' || req.method === 'OPTIONS' || req.method === 'HEAD') {
        return next();
    }

    // Mounted once — but guard if anything wraps again
    if (res[LOGGED]) {
        return next();
    }
    res[LOGGED] = true;

    const originalJson = res.json.bind(res);

    res.json = function (data) {
        try {
            const adminId = req.admin?.id;
            if (adminId) {
                AdminMongoService.logActivity({
                    adminId,
                    adminEmail: req.admin?.email,
                    method: req.method,
                    path: truncatePath(req.originalUrl.split('?')[0]),
                    timestamp: new Date(),
                }).catch((err) => console.error('Activity logging failed:', err.message));
            }
        } catch (error) {
            console.error('Activity logging error:', error.message);
        }

        return originalJson(data);
    };

    next();
};

export default logActivity;
