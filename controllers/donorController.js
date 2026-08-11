const pool = require('../config/db');

exports.getDashboard = async (req, res) => {
    try {
        const [donorRows] = await pool.execute(`
            SELECT d.*, u.status AS user_status 
            FROM donors d 
            JOIN users u ON d.user_id = u.id 
            WHERE d.user_id = ?
        `, [req.session.user.id]);
        
        if (donorRows.length === 0) return res.redirect('/auth/login');
        const donorData = donorRows[0];
        const donorId = donorData.id;

        // Statistics for motivational dashboard
        const [stats] = await pool.execute('SELECT COUNT(*) as total_donations, SUM(quantity) as total_units FROM donations WHERE donor_id = ? AND status = "completed"', [donorId]);
        
        const totalDonations = stats[0].total_donations || 0;
        const totalUnits = stats[0].total_units || 0;
        const livesSaved = totalDonations * 3; // Estimated impact

        // Eligibility check using DB function
        const [eligResult] = await pool.execute('SELECT fn_is_eligible_to_donate(?) AS is_eligible', [donorId]);
        const isEligible = eligResult[0].is_eligible === 1;

        // Days until next eligible donation
        let daysUntilEligible = 0;
        if (!isEligible && donorData.last_donation_date) {
            const lastDate = new Date(donorData.last_donation_date);
            const nextDate = new Date(lastDate);
            nextDate.setDate(nextDate.getDate() + 90);
            daysUntilEligible = Math.ceil((nextDate - new Date()) / (1000 * 60 * 60 * 24));
        }

        // Check for pending deactivation
        const [deactivationRequest] = await pool.execute(
            'SELECT status FROM deactivation_requests WHERE user_id = ? AND status = "pending"',
            [req.session.user.id]
        );

        res.render('donor/dashboard', {
            user: req.session.user,
            donor: donorData,
            stats: { totalDonations, totalUnits, livesSaved },
            isEligible,
            daysUntilEligible,
            hasPendingDeactivation: deactivationRequest.length > 0
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Donor Dashboard Error');
    }
};

exports.updateProfile = async (req, res) => {
    const { contact, address } = req.body;
    const connection = await pool.getConnection();
    try {
        await pool.setIsolationLevel(connection, 'READ COMMITTED');
        await connection.beginTransaction();
        
        await connection.execute('UPDATE donors SET contact = ?, address = ? WHERE user_id = ?', [contact, address, req.session.user.id]);
        
        await connection.commit();
        res.redirect('/donor/dashboard');
    } catch (err) {
        if (connection) await connection.rollback();
        console.error(err);
        res.status(500).send('Profile Update Error');
    } finally {
        connection.release();
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
