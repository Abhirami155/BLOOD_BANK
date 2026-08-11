const pool = require('../config/db');
const logger = require('../utils/logger');

exports.getDashboard = async (req, res) => {
    try {
        const [doctor] = await pool.execute(
            'SELECT d.*, h.name as hospital_name FROM doctors d JOIN hospitals h ON d.hospital_id = h.id WHERE d.user_id = ?',
            [req.session.user.id]
        );
        const doctorId = doctor[0].id;
        const hospitalId = doctor[0].hospital_id;

        // ONLY Patients assigned to THIS doctor at this hospital
        const [patients] = await pool.execute(
            'SELECT id, name, blood_group FROM patients WHERE hospital_id = ? AND doctor_id = ?',
            [hospitalId, doctorId]
        );

        // Fetch hospital inventory for the stock preview feature
        const [inventory] = await pool.execute(
            'SELECT blood_group, quantity FROM blood_inventory WHERE hospital_id = ?',
            [hospitalId]
        );

        // Requests with patient name joined
        const [requests] = await pool.execute(
            `SELECT r.*, p.name AS patient_name
             FROM requests r
             LEFT JOIN patients p ON r.patient_id = p.id
             WHERE r.doctor_id = ?
             ORDER BY r.created_at DESC`,
            [doctorId]
        );

        // Check for pending deactivation
        const [deactivationRequest] = await pool.execute(
            'SELECT status FROM deactivation_requests WHERE user_id = ? AND status = "pending"',
            [req.session.user.id]
        );

        res.render('doctor/dashboard', {
            user: req.session.user,
            doctor: doctor[0],
            patients,
            inventory, // Send inventory for dynamic stock preview
            requests,
            hasPendingDeactivation: deactivationRequest.length > 0
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Doctor Dashboard Error');
    }
};

exports.createRequest = async (req, res) => {
    const { patient_id, blood_group, quantity, urgency, reason } = req.body;
    try {
        const [doctor] = await pool.execute('SELECT id, hospital_id FROM doctors WHERE user_id = ?', [req.session.user.id]);
        const hospitalId = doctor[0].hospital_id;
        const doctorId = doctor[0].id;

        // Check for stock shortage
        const [inv] = await pool.execute(
            'SELECT quantity FROM blood_inventory WHERE hospital_id = ? AND blood_group = ?',
            [hospitalId, blood_group]
        );
        const availableStock = inv.length > 0 ? inv[0].quantity : 0;
        const stock_shortage = quantity > availableStock ? 1 : 0;

        // Using direct INSERT instead of SP to handle new 'reason' and 'stock_shortage' fields
        await pool.execute(
            `INSERT INTO requests (requester_id, patient_id, doctor_id, hospital_id, blood_group, quantity, urgency, reason, stock_shortage, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [req.session.user.id, patient_id, doctorId, hospitalId, blood_group, quantity, urgency, reason, stock_shortage]
        );

        // Descriptive Logging
        const [patientRow] = await pool.execute('SELECT name FROM patients WHERE id = ?', [patient_id]);
        const patientName = patientRow.length > 0 ? patientRow[0].name : 'Unknown';
        const [doctorRow] = await pool.execute('SELECT name FROM doctors WHERE id = ?', [doctorId]);
        const doctorName = doctorRow.length > 0 ? doctorRow[0].name : 'Doctor';

        await logger.logActivity({
            actor_name: doctorName,
            actor_role: 'doctor',
            action_type: 'Raised blood request',
            description: `${doctorName} raised blood request for ${patientName} (${blood_group}, ${quantity} Units)`,
            target: `Patient ${patientName}`,
            hospital_id: hospitalId
        });

        // For success popup in UI, we'll redirect with a success flag
        res.redirect('/doctor/dashboard?success=true&patient=' + patient_id);
    } catch (err) {
        console.error(err);
        res.status(500).send('Blood Request Error');
    }
};

exports.getPatients = async (req, res) => {
    try {
        const [doctor] = await pool.execute('SELECT id, hospital_id FROM doctors WHERE user_id = ?', [req.session.user.id]);
        const [rows] = await pool.execute('SELECT * FROM patients WHERE hospital_id = ? AND doctor_id = ?', [doctor[0].hospital_id, doctor[0].id]);
        res.render('doctor/patients', { user: req.session.user, patients: rows });
    } catch (err) {
        console.error(err);
        res.status(500).send('Doctor Patients Error');
    }
};
