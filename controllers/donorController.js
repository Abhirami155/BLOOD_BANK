const pool = require('../config/db');

exports.getDashboard = async (req, res) => {
    try {
        const [donor] = await pool.execute('SELECT * FROM donors WHERE user_id = ?', [req.session.user.id]);
        if (donor.length === 0) return res.redirect('/auth/login');
        const donorId = donor[0].id;

        // Statistics for motivational dashboard
        const [stats] = await pool.execute('SELECT COUNT(*) as total_donations, SUM(quantity) as total_units FROM donations WHERE donor_id = ? AND status = "completed"', [donorId]);
        
        const totalDonations = stats[0].total_donations || 0;
        const totalUnits = stats[0].total_units || 0;
        const livesSaved = totalDonations * 3; // Estimated impact

        res.render('donor/dashboard', {
            user: req.session.user,
            donor: donor[0],
            stats: { totalDonations, totalUnits, livesSaved }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Donor Dashboard Error');
    }
};

exports.updateProfile = async (req, res) => {
    const { contact, address } = req.body;
    try {
        await pool.execute('UPDATE donors SET contact = ?, address = ? WHERE user_id = ?', [contact, address, req.session.user.id]);
        res.redirect('/donor/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Profile Update Error');
    }
};

exports.getHistory = async (req, res) => {
    try {
        const [donor] = await pool.execute('SELECT id FROM donors WHERE user_id = ?', [req.session.user.id]);
        const donorId = donor[0].id;
        const [history] = await pool.execute('SELECT d.*, h.name as hospital_name FROM donations d JOIN hospitals h ON d.hospital_id = h.id WHERE d.donor_id = ? ORDER BY d.donation_date DESC', [donorId]);
        
        res.render('donor/history', { user: req.session.user, history });
    } catch (err) {
        console.error(err);
        res.status(500).send('Donor History Error');
    }
};
