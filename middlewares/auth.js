module.exports = {
    isAuthenticated: (req, res, next) => {
        if (req.session.user) {
            return next();
        }
        // Return JSON for AJAX requests
        if (req.headers['content-type'] === 'application/json' || req.headers['accept'] === 'application/json') {
            return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
        }
        res.redirect('/auth/login');
    },

    isRole: (roles) => {
        return (req, res, next) => {
            const isAjax = req.headers['content-type'] === 'application/json' || req.headers['accept'] === 'application/json';
            if (!req.session.user) {
                if (isAjax) return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
                return res.redirect('/auth/login');
            }
            if (roles.includes(req.session.user.role)) {
                return next();
            }
            if (isAjax) return res.status(403).json({ success: false, message: 'Unauthorized Access' });
            res.status(403).render('error', { message: 'Unauthorized Access' });
        };
    },

    // Specific role shorthand
    isAdmin: (req, res, next) => module.exports.isRole(['admin'])(req, res, next),
    isHospital: (req, res, next) => module.exports.isRole(['hospital'])(req, res, next),
    isDoctor: (req, res, next) => module.exports.isRole(['doctor'])(req, res, next),
    isDonor: (req, res, next) => module.exports.isRole(['donor'])(req, res, next),
    isPatient: (req, res, next) => module.exports.isRole(['patient'])(req, res, next)
};
