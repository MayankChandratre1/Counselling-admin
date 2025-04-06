import jwt from 'jsonwebtoken';

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.token;
        if (!token) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_ADMIN_SECRET);
        
        // Ensure role is present in decoded token
        if (!decoded.role) {
            return res.status(401).json({ message: 'Invalid token: no role specified' });
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
