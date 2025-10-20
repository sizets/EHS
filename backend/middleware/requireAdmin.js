const requireAdmin = (req, res, next) => {
    try {
        // Check if user is authenticated and has admin role
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ 
                error: 'Access denied. Admin privileges required.' 
            });
        }
        next();
    } catch (error) {
        console.error('Admin middleware error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = requireAdmin;
