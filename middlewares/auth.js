module.exports = {
    isAuthenticated: (req, res, next) => {
        if (req.session.user) {
            return next();
        }
        res.redirect('/auth/login');
    },

    isRole: (roles) => {
        return (req, res, next) => {
            if (!req.session.user) {
                return res.redirect('/auth/login');
            }
            if (roles.includes(req.session.user.role)) {
                return next();
            }
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
