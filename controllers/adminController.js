const pool = require('../config/db');

exports.getDashboard = async (req, res) => {
    try {
        const [hospitals] = await pool.execute('SELECT COUNT(*) as count FROM hospitals');
        const [donors] = await pool.execute('SELECT COUNT(*) as count FROM donors');
        const [doctors] = await pool.execute('SELECT COUNT(*) as count FROM doctors');
        const [stock] = await pool.execute('SELECT blood_group, SUM(quantity) as total FROM blood_inventory GROUP BY blood_group');
        const [pendingDonors] = await pool.execute('SELECT * FROM donors WHERE registration_status = "pending"');
        const [recentRequests] = await pool.execute('SELECT * FROM requests ORDER BY created_at DESC LIMIT 5');

        res.render('admin/dashboard', {
            user: req.session.user,
            stats: {
                hospitals: hospitals[0].count,
                donors: donors[0].count,
                doctors: doctors[0].count
            },
            stock,
            pendingDonors,
            recentRequests
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Admin Dashboard Error');
    }
};

exports.getHospitals = async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM hospitals');
        res.render('admin/hospitals', { user: req.session.user, hospitals: rows });
    } catch (err) {
        console.error(err);
        res.status(500).send('Admin Hospitals Error');
    }
};

exports.getDoctors = async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT d.*, h.name as hospital_name FROM doctors d JOIN hospitals h ON d.hospital_id = h.id');
        res.render('admin/doctors', { user: req.session.user, doctors: rows });
    } catch (err) {
        console.error(err);
        res.status(500).send('Admin Doctors Error');
    }
};

exports.getDonors = async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM donors');
        res.render('admin/donors', { user: req.session.user, donors: rows });
    } catch (err) {
        console.error(err);
        res.status(500).send('Admin Donors Error');
    }
};

exports.getStock = async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT bi.*, h.name as hospital_name FROM blood_inventory bi JOIN hospitals h ON bi.hospital_id = h.id');
        res.render('admin/stock', { user: req.session.user, stock: rows });
    } catch (err) {
        console.error(err);
        res.status(500).send('Admin Stock Error');
    }
};

exports.approveDonor = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.execute('UPDATE donors SET registration_status = "approved" WHERE id = ?', [id]);
        res.redirect('/admin/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Approval Error');
    }
};

exports.rejectDonor = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.execute('UPDATE donors SET registration_status = "rejected" WHERE id = ?', [id]);
        res.redirect('/admin/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Rejection Error');
    }
};
