const pool = require('../config/db');

exports.getDashboard = async (req, res) => {
    try {
        const [hospital] = await pool.execute('SELECT * FROM hospitals WHERE user_id = ?', [req.session.user.id]);
        const hospitalId = hospital[0].id;

        const [inventory] = await pool.execute('SELECT * FROM blood_inventory WHERE hospital_id = ?', [hospitalId]);
        const [patients] = await pool.execute('SELECT COUNT(*) as count FROM patients WHERE hospital_id = ?', [hospitalId]);
        const [recentDonations] = await pool.execute('SELECT d.*, dn.name as donor_name FROM donations d JOIN donors dn ON d.donor_id = dn.id WHERE d.hospital_id = ? ORDER BY d.donation_date DESC LIMIT 5', [hospitalId]);
        const [pendingRequests] = await pool.execute('SELECT * FROM requests WHERE hospital_id = ? AND status = "pending"', [hospitalId]);

        res.render('hospital/dashboard', {
            user: req.session.user,
            hospital: hospital[0],
            inventory,
            patientCount: patients[0].count,
            recentDonations,
            pendingRequests
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Hospital Dashboard Error');
    }
};

exports.getPatients = async (req, res) => {
    try {
        const [hospital] = await pool.execute('SELECT id FROM hospitals WHERE user_id = ?', [req.session.user.id]);
        const [rows] = await pool.execute('SELECT * FROM patients WHERE hospital_id = ?', [hospital[0].id]);
        res.render('hospital/patients', { user: req.session.user, patients: rows });
    } catch (err) {
        console.error(err);
        res.status(500).send('Hospital Patients Error');
    }
};

exports.addPatient = async (req, res) => {
    const { name, age, gender, blood_group, contact } = req.body;
    try {
        const [hospital] = await pool.execute('SELECT id FROM hospitals WHERE user_id = ?', [req.session.user.id]);
        await pool.execute(
            'INSERT INTO patients (hospital_id, name, age, gender, blood_group, contact) VALUES (?, ?, ?, ?, ?, ?)',
            [hospital[0].id, name, age, gender, blood_group, contact]
        );
        res.redirect('/hospital/patients');
    } catch (err) {
        console.error(err);
        res.status(500).send('Patient Registration Error');
    }
};

exports.updateInventory = async (req, res) => {
    const { blood_group, quantity } = req.body;
    try {
        const [hospital] = await pool.execute('SELECT id FROM hospitals WHERE user_id = ?', [req.session.user.id]);
        await pool.execute(
            'INSERT INTO blood_inventory (hospital_id, blood_group, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = ?',
            [hospital[0].id, blood_group, quantity, quantity]
        );
        res.redirect('/hospital/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Inventory Update Error');
    }
};

exports.addDonation = async (req, res) => {
    const { donor_id, blood_group, quantity, date } = req.body;
    try {
        const [hospital] = await pool.execute('SELECT id FROM hospitals WHERE user_id = ?', [req.session.user.id]);
        await pool.execute(
            'INSERT INTO donations (donor_id, hospital_id, blood_group, quantity, donation_date, status) VALUES (?, ?, ?, ?, ?, ?)',
            [donor_id, hospital[0].id, blood_group, quantity, date, 'completed']
        );
        res.redirect('/hospital/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Donation Recording Error');
    }
};

exports.handleRequest = async (req, res) => {
    const { requestId, action } = req.params;
    try {
        await pool.execute('UPDATE requests SET status = ? WHERE id = ?', [action, requestId]);
        res.redirect('/hospital/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Request Handling Error');
    }
};

exports.getInventory = async (req, res) => {
    res.redirect('/hospital/dashboard#inventory');
};
