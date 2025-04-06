const authorize = (allowedRoles) => {
    return (req, res, next) => {
        try {
            // admin data is set by authMiddleware
            const userRole = req.admin?.role;

            if (!userRole) {
                return res.status(403).json({ 
                    message: 'No role assigned' 
                });
            }

            if (!allowedRoles.includes(userRole)) {
                return res.status(403).json({ 
                    message: 'You do not have permission to perform this action' 
                });
            }

            next();
        } catch (error) {
            console.error('Authorization error:', error);
            res.status(403).json({ 
                message: 'Authorization failed' 
            });
        }
    };
};

export default authorize;
