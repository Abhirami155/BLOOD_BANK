const pool = require('../config/db');

// ─── PATIENT DASHBOARD ───────────────────────────────────────────────────────
// Patients only VIEW their requests (raised by their doctor).
// They cannot raise blood requests directly.
exports.getDashboard = async (req, res) => {
    try {
        // 1. Get the patient record linked to this logged-in user
        const [patientRows] = await pool.execute(
            `SELECT p.*, 
                    h.name AS hospital_name, h.address AS hospital_address, h.city AS hospital_city, h.contact AS hospital_contact,
                    d.name AS doctor_name, d.specialization AS doctor_specialization, d.contact AS doctor_contact
             FROM patients p
             JOIN hospitals h ON p.hospital_id = h.id
             LEFT JOIN doctors d ON p.doctor_id = d.id
             WHERE p.user_id = ?`,
            [req.session.user.id]
        );

        if (patientRows.length === 0) {
            return res.render('patient/dashboard', {
                user: req.session.user,
                patient: null,
                requests: [],
                searchResults: null
            });
        }

        const patient = patientRows[0];

        // 2. Get blood requests raised by the doctor FOR this patient
        const [requests] = await pool.execute(
            `SELECT r.*, 
                    h.name AS hospital_name,
                    d.name AS doctor_name
             FROM requests r
             JOIN hospitals h ON r.hospital_id = h.id
             LEFT JOIN doctors d ON r.doctor_id = d.id
             WHERE r.patient_id = ?
             ORDER BY r.created_at DESC`,
            [patient.id]
        );

        // Check for pending deactivation
        const [deactivationRequest] = await pool.execute(
            'SELECT status FROM deactivation_requests WHERE user_id = ? AND status = "pending"',
            [req.session.user.id]
        );

        res.render('patient/dashboard', {
            user: req.session.user,
            patient,
            requests,
            searchResults: null,
            hasPendingDeactivation: deactivationRequest.length > 0
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Patient Dashboard Error');
    }
};

// ─── BLOOD AVAILABILITY SEARCH ───────────────────────────────────────────────
exports.searchBlood = async (req, res) => {
    const { blood_group, city } = req.body;
    try {
        const query = `
            SELECT bi.*, h.name AS hospital_name, h.city, h.contact 
            FROM blood_inventory bi 
            JOIN hospitals h ON bi.hospital_id = h.id 
            WHERE bi.blood_group = ? AND h.city LIKE ? AND bi.quantity > 0
        `;
        const [results] = await pool.execute(query, [blood_group, `%${city}%`]);

        // Re-fetch patient and requests for dashboard re-render
        const [patientRows] = await pool.execute(
            `SELECT p.*, 
                    h.name AS hospital_name, h.address AS hospital_address, h.city AS hospital_city, h.contact AS hospital_contact,
                    d.name AS doctor_name, d.specialization AS doctor_specialization, d.contact AS doctor_contact
             FROM patients p
             JOIN hospitals h ON p.hospital_id = h.id
             LEFT JOIN doctors d ON p.doctor_id = d.id
             WHERE p.user_id = ?`,
            [req.session.user.id]
        );

        const patient = patientRows[0] || null;

        let requests = [];
        if (patient) {
            [requests] = await pool.execute(
                `SELECT r.*, h.name AS hospital_name, d.name AS doctor_name
                 FROM requests r
                 JOIN hospitals h ON r.hospital_id = h.id
                 LEFT JOIN doctors d ON r.doctor_id = d.id
                 WHERE r.patient_id = ?
                 ORDER BY r.created_at DESC`,
                [patient.id]
            );
        }

        res.render('patient/dashboard', {
            user: req.session.user,
            patient,
            requests,
            searchResults: results,
            searchQuery: { blood_group, city }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Search Error');
    }
};

// ─── BLOCK DIRECT REQUEST CREATION ───────────────────────────────────────────
// Patients must contact their doctor. Doctors raise requests on their behalf.
exports.createRequest = (req, res) => {
    res.status(403).send('Access Denied: Patients cannot raise blood requests directly. Please contact your assigned doctor.');
};

exports.getRequests = async (req, res) => {
    res.redirect('/patient/dashboard#requests');
};
