import jwt from 'jsonwebtoken';
import { DeviceApproval } from '../models/deviceApproval.model.js';

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers['token'] ||
            req.headers['Token'] || req.get('Token');
        if (!token) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_ADMIN_SECRET);
        
        // Ensure role is present in decoded token
        if (!decoded.role) {
            return res.status(401).json({ message: 'Invalid token: no role specified' });
        }

        // Security-admin must always be able to access security operations,
        // so they are exempt from device-approval gate.
        if (decoded.role === 'security-admin') {
            req.admin = decoded;
            return next();
        }

        if (!decoded.deviceId || decoded.scope !== 'full') {
            return res.status(401).json({ message: 'Invalid token scope for admin access' });
        }

        const approval = await DeviceApproval.findOne({
            userId: decoded.id,
            deviceId: decoded.deviceId
        }).select('status');

        if (!approval || approval.status !== 'approved') {
            return res.status(403).json({
                message: 'Device access is not approved for this admin account',
                approvalStatus: approval?.status || 'missing'
            });
        }

        req.admin = decoded; // Contains id, email, and role
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired' });
        }
        return res.status(401).json({ message: 'Invalid token' });
    }
};

export default authMiddleware;
