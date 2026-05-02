const hasSecurityPrivileges = (admin) => {
    if (!admin) return false;

    if (admin.role === 'security-admin') return true;
    if (admin.role === 'super-admin' && Boolean(admin.isSecurityMod)) return true;

    return false;
};

const requireSecurityPrivileges = (req, res, next) => {
    if (!hasSecurityPrivileges(req.admin)) {
        return res.status(403).json({
            message: 'You do not have permission to perform this action'
        });
    }

    next();
};

export { hasSecurityPrivileges, requireSecurityPrivileges };
