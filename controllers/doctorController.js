const pool = require('../config/db');

exports.getDashboard = async (req, res) => {
    try {
        const [doctor] = await pool.execute('SELECT d.*, h.name as hospital_name FROM doctors d JOIN hospitals h ON d.hospital_id = h.id WHERE d.user_id = ?', [req.session.user.id]);
        const doctorId = doctor[0].id;
        const hospitalId = doctor[0].hospital_id;

        const [patients] = await pool.execute('SELECT * FROM patients WHERE hospital_id = ?', [hospitalId]);
        const [requests] = await pool.execute('SELECT * FROM requests WHERE doctor_id = ? ORDER BY created_at DESC', [doctorId]);

        res.render('doctor/dashboard', {
            user: req.session.user,
            doctor: doctor[0],
            patients,
            requests
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Doctor Dashboard Error');
    }
};

exports.getPatients = async (req, res) => {
    try {
        const [doctor] = await pool.execute('SELECT hospital_id FROM doctors WHERE user_id = ?', [req.session.user.id]);
        const [rows] = await pool.execute('SELECT * FROM patients WHERE hospital_id = ?', [doctor[0].hospital_id]);
        res.render('doctor/patients', { user: req.session.user, patients: rows });
    } catch (err) {
        console.error(err);
        res.status(500).send('Doctor Patients Error');
    }
};

exports.createRequest = async (req, res) => {
    const { patient_id, blood_group, quantity, urgency } = req.body;
    try {
        const [doctor] = await pool.execute('SELECT id, hospital_id FROM doctors WHERE user_id = ?', [req.session.user.id]);
        await pool.execute(
            'CALL sp_create_blood_request(?, ?, ?, ?, ?, ?, ?)',
            [req.session.user.id, patient_id, doctor[0].id, doctor[0].hospital_id, blood_group, quantity, urgency]
        );
        res.redirect('/doctor/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Blood Request Error');
    }
};
