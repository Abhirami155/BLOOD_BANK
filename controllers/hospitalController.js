const pool = require('../config/db');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');

exports.getDashboard = async (req, res) => {
    try {
        const [hospital] = await pool.execute('SELECT * FROM hospitals WHERE user_id = ?', [req.session.user.id]);
        const hospitalId = hospital[0].id;

        const [inventory] = await pool.execute('SELECT * FROM blood_inventory WHERE hospital_id = ?', [hospitalId]);
        const [patients] = await pool.execute('SELECT COUNT(*) as count FROM patients WHERE hospital_id = ?', [hospitalId]);
        const [recentDonations] = await pool.execute(
            'SELECT d.*, dn.name as donor_name FROM donations d JOIN donors dn ON d.donor_id = dn.id WHERE d.hospital_id = ? ORDER BY d.donation_date DESC LIMIT 5',
            [hospitalId]
        );

        // Fetch PENDING + APPROVED + PROCESSING requests with doctor and patient names
        // PRIORITIZE CRITICAL URGENCY first
        const [activeRequests] = await pool.execute(
            `SELECT r.*, 
                    d.name AS doctor_name,
                    p.name AS patient_name
             FROM requests r
             LEFT JOIN doctors d ON r.doctor_id = d.id
             LEFT JOIN patients p ON r.patient_id = p.id
             WHERE r.hospital_id = ? AND r.status IN ('pending', 'approved', 'processing')
             ORDER BY 
                CASE WHEN r.urgency = 'critical' THEN 0 ELSE 1 END,
                r.created_at DESC`,
            [hospitalId]
        );

        // Check for pending deactivation
        const [deactivationRequest] = await pool.execute(
            'SELECT status FROM deactivation_requests WHERE user_id = ? AND status = "pending"',
            [req.session.user.id]
        );

        res.render('hospital/dashboard', {
            user: req.session.user,
            hospital: hospital[0],
            inventory,
            patientCount: patients[0].count,
            recentDonations,
            activeRequests,
            hasPendingDeactivation: deactivationRequest.length > 0
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Hospital Dashboard Error');
    }
};

exports.getPatients = async (req, res) => {
    try {
        const [hospital] = await pool.execute('SELECT id FROM hospitals WHERE user_id = ?', [req.session.user.id]);
        const hospitalId = hospital[0].id;
        const [rows] = await pool.execute('SELECT p.*, d.name AS doctor_name FROM patients p LEFT JOIN doctors d ON p.doctor_id = d.id WHERE p.hospital_id = ?', [hospitalId]);
        const [doctors] = await pool.execute('SELECT id, name FROM doctors WHERE hospital_id = ?', [hospitalId]);
        res.render('hospital/patients', { user: req.session.user, patients: rows, doctors });
    } catch (err) {
        console.error(err);
        res.status(500).send('Hospital Patients Error');
    }
};

exports.addPatient = async (req, res) => {
    console.log('[DEBUG] addPatient called with:', JSON.stringify(req.body));
    const { name, age, gender, blood_group, assigned_doctor_id, contact_number, email, password } = req.body;

    // 1. Validate required fields
    if (!name || !age || !gender || !blood_group || !contact_number || !email || !password) {
        return res.status(400).json({ success: false, message: 'All fields are mandatory' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 2. Check email is unique
        const [existingUser] = await connection.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: 'Patient email already exists' });
        }

        // 3. Get Hospital Info
        const [hospitalRows] = await connection.execute('SELECT id, name FROM hospitals WHERE user_id = ?', [req.session.user.id]);
        if (hospitalRows.length === 0) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: 'Assigned hospital is invalid' });
        }
        const hospitalId = hospitalRows[0].id;
        const hospitalName = hospitalRows[0].name;

        // 4. Validate Doctor if provided
        if (assigned_doctor_id) {
            const [doctorRows] = await connection.execute(
                'SELECT id FROM doctors WHERE id = ? AND hospital_id = ?',
                [assigned_doctor_id, hospitalId]
            );
            if (doctorRows.length === 0) {
                await connection.rollback();
                return res.status(400).json({ success: false, message: 'Assigned doctor is invalid' });
            }
        }

        // 5. Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // 6. Insert into users table FIRST (same pattern as doctors/donors)
        //    status must be lowercase 'active' to match DB enum('active','pending','inactive')
        const [userResult] = await connection.execute(
            'INSERT INTO users (email, password, role, status) VALUES (?, ?, ?, ?)',
            [email, hashedPassword, 'patient', 'active']
        );
        const userId = userResult.insertId;

        // 7. Insert into patients table with user_id linkage
        await connection.execute(
            'INSERT INTO patients (user_id, hospital_id, doctor_id, name, age, gender, blood_group, contact) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [userId, hospitalId, assigned_doctor_id || null, name, age, gender, blood_group, contact_number]
        );

        // 8. Log activity
        await logger.logActivity({
            actor_name: hospitalName,
            actor_role: 'hospital',
            action_type: 'Admitted Patient',
            description: `🏥 ${hospitalName} admitted patient ${name} and created portal access`,
            target: `Patient ${name}`,
            hospital_id: hospitalId
        });

        await connection.commit();
        res.json({ success: true, message: 'Patient Registered Successfully' });
    } catch (err) {
        if (connection) await connection.rollback();
        const fs = require('fs');
        fs.appendFileSync('error_log.txt', `[${new Date().toISOString()}] Patient Admission Error: ${err.message}\n${err.stack}\n`);
        console.error('Patient Admission Error:', err);
        res.status(500).json({ success: false, message: 'Unable to create patient account: ' + err.message, stack: err.stack });
    } finally {
        if (connection) connection.release();
    }
};

exports.updateInventory = async (req, res) => {
    const { blood_group, quantity } = req.body;
    const connection = await pool.getConnection();
    try {
        await pool.setIsolationLevel(connection, 'READ COMMITTED');
        await connection.beginTransaction();

        const [hospital] = await connection.execute('SELECT id FROM hospitals WHERE user_id = ?', [req.session.user.id]);
        
        await connection.execute(
            'INSERT INTO blood_inventory (hospital_id, blood_group, quantity, version) VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE quantity = ?, version = version + 1',
            [hospital[0].id, blood_group, quantity, quantity]
        );

        const [hospitalInfo] = await connection.execute('SELECT name FROM hospitals WHERE id = ?', [hospital[0].id]);
        await logger.logActivity({
            actor_name: hospitalInfo[0].name,
            actor_role: 'hospital',
            action_type: 'Updated inventory',
            description: `${hospitalInfo[0].name} updated ${blood_group} inventory to ${quantity} Units`,
            target: `${blood_group} blood inventory`,
            hospital_id: hospital[0].id
        });

        await connection.commit();
        res.redirect('/hospital/dashboard');
    } catch (err) {
        if (connection) await connection.rollback();
        console.error(err);
        res.status(500).send('Inventory Update Error');
    } finally {
        connection.release();
    }
};

exports.addDonation = async (req, res) => {
    const { donor_id, blood_group, quantity, date } = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Get Hospital ID
        const [hospital] = await connection.execute('SELECT id, name FROM hospitals WHERE user_id = ?', [req.session.user.id]);
        const hospitalId = hospital[0].id;
        const hospitalName = hospital[0].name;

        // 2. Record the donation
        await connection.execute(
            'INSERT INTO donations (donor_id, hospital_id, blood_group, quantity, donation_date, status) VALUES (?, ?, ?, ?, ?, ?)',
            [donor_id, hospitalId, blood_group, quantity, date, 'completed']
        );
        console.log(`[DEBUG] Donation inserted ✔ (Donor: ${donor_id}, Group: ${blood_group}, Qty: ${quantity})`);

        // 3. Update blood_inventory immediately (Atomic increment)
        await connection.execute(
            `INSERT INTO blood_inventory (hospital_id, blood_group, quantity, version) 
             VALUES (?, ?, ?, 1) 
             ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity), version = version + 1`,
            [hospitalId, blood_group, quantity]
        );
        console.log(`[DEBUG] Inventory updated ✔ (Hospital: ${hospitalName}, Group: ${blood_group}, added ${quantity} units)`);

        // 4. Log activity
        const [donorInfo] = await connection.execute('SELECT name FROM donors WHERE id = ?', [donor_id]);
        await logger.logActivity({
            actor_name: donorInfo[0] ? donorInfo[0].name : 'Unknown Donor',
            actor_role: 'donor',
            action_type: 'Donated blood',
            description: `${donorInfo[0] ? donorInfo[0].name : 'Donor #' + donor_id} donated ${quantity} unit(s) of ${blood_group} to ${hospitalName}`,
            target: `${hospitalName}`,
            hospital_id: hospitalId
        });

        await connection.commit();
        res.redirect('/hospital/dashboard');
    } catch (err) {
        if (connection) await connection.rollback();
        console.error('[ERROR] Donation Recording Error:', err);
        res.status(500).send('Donation Recording Error');
    } finally {
        if (connection) connection.release();
    }
};

exports.handleRequest = async (req, res) => {
    const { requestId, action } = req.params;

    // Only valid actions are: approved, rejected, processing, completed
    const validActions = ['approved', 'rejected', 'processing', 'completed'];
    if (!validActions.includes(action)) {
        return res.status(400).send('Invalid action.');
    }

    const connection = await pool.getConnection();
    try {
        await pool.setIsolationLevel(connection, 'REPEATABLE READ');
        await connection.beginTransaction();

        // Fetch the current request
        const [reqRow] = await connection.execute('SELECT * FROM requests WHERE id = ?', [requestId]);
        if (reqRow.length === 0) {
            await connection.rollback();
            return res.status(404).send('Request not found.');
        }
        const request = reqRow[0];

        // PENDING → APPROVED or REJECTED (only)
        // APPROVED → PROCESSING (only)
        // PROCESSING → COMPLETED (only)
        if (action === 'approved' && request.status !== 'pending') {
            await connection.rollback();
            return res.status(400).send('Request can only be approved when it is in PENDING status.');
        }
        if (action === 'rejected' && request.status !== 'pending') {
            await connection.rollback();
            return res.status(400).send('Request can only be rejected when it is in PENDING status.');
        }
        if (action === 'processing' && request.status !== 'approved') {
            await connection.rollback();
            return res.status(400).send('Request can only be marked as processing after it has been APPROVED.');
        }
        if (action === 'completed' && request.status !== 'processing') {
            await connection.rollback();
            return res.status(400).send('Request can only be completed after it has been through PROCESSING.');
        }

        // ── Inventory check for completion ───────────────────────────────────
        if (action === 'completed') {
            const [invRow] = await connection.execute(
                'SELECT quantity FROM blood_inventory WHERE hospital_id = ? AND blood_group = ? FOR UPDATE',
                [request.hospital_id, request.blood_group]
            );
            if (invRow.length === 0 || invRow[0].quantity < request.quantity) {
                await connection.rollback();
                return res.status(400).send(`Insufficient stock: only ${invRow[0]?.quantity || 0} units of ${request.blood_group} available. Cannot complete.`);
            }
        }

        // ── Apply the status change ──────────────────────────────────────────
        await connection.execute('UPDATE requests SET status = ? WHERE id = ?', [action, requestId]);

        // ── Deduct from inventory if completed ────────────────────────────────
        if (action === 'completed') {
            await connection.execute(
                'UPDATE blood_inventory SET quantity = quantity - ? WHERE hospital_id = ? AND blood_group = ?',
                [request.quantity, request.hospital_id, request.blood_group]
            );
            console.log(`[DEBUG] Inventory deducted ✔ (Hospital: ${request.hospital_id}, Group: ${request.blood_group}, removed ${request.quantity} units)`);
        }

        const [hInfo] = await connection.execute('SELECT name FROM hospitals WHERE id = ?', [request.hospital_id]);
        const [pInfo] = await connection.execute('SELECT name FROM patients WHERE id = ?', [request.patient_id]);
        
        let desc = `${hInfo[0].name} ${action} request for ${pInfo[0].name}`;
        if (action === 'completed') desc = `${hInfo[0].name} issued blood to ${pInfo[0].name}`;
        if (action === 'rejected') desc = `${hInfo[0].name} rejected blood request for ${pInfo[0].name} due to insufficient stock`;

        await logger.logActivity({
            actor_name: hInfo[0].name,
            actor_role: 'hospital',
            action_type: action.charAt(0).toUpperCase() + action.slice(1) + ' request',
            description: desc,
            target: `Patient ${pInfo[0].name}`,
            hospital_id: request.hospital_id
        });
        
        await connection.commit();
        res.redirect('/hospital/dashboard');
    } catch (err) {
        if (connection) await connection.rollback();
        console.error(err);
        res.status(500).send('Request Handling Error');
    } finally {
        connection.release();
    }
};

exports.getInventory = async (req, res) => {
    res.redirect('/hospital/dashboard#inventory');
};

exports.getSearchDonors = async (req, res) => {
    const { blood_group, city } = req.query;
    try {
        const [hospitalRows] = await pool.execute('SELECT id, name FROM hospitals WHERE user_id = ?', [req.session.user.id]);
        const hospitalId = hospitalRows[0].id;
        const hospitalName = hospitalRows[0].name;

        let query = `
            SELECT d.*, u.status, 
                   (SELECT MAX(donation_date) FROM donations WHERE donor_id = d.id AND status = 'completed') as last_donation
            FROM donors d
            JOIN users u ON d.user_id = u.id
            WHERE u.status = 'active' AND d.registration_status = 'approved'
        `;
        const params = [];

        if (blood_group && blood_group !== '') {
            query += ' AND d.blood_group = ?';
            params.push(blood_group);
        }

        if (city && city.trim() !== '') {
            query += ' AND d.address LIKE ?';
            params.push(`%${city.trim()}%`);
        }

        query += ' ORDER BY d.name ASC';

        const [donors] = await pool.execute(query, params);

        // Log the search if it was a real search (not just initial load)
        if (blood_group || city) {
            await logger.logActivity({
                actor_name: hospitalName,
                actor_role: 'hospital',
                action_type: 'Searched Donors',
                description: `🏥 ${hospitalName} searched for ${blood_group || 'any'} blood group donors in ${city || 'any city'}`,
                target: `Donor Search: ${blood_group || 'All'} / ${city || 'All'}`,
                hospital_id: hospitalId
            });
        }

        res.render('hospital/search_donors', { 
            user: req.session.user, 
            donors, 
            searchParams: { blood_group, city } 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Donor Search Error');
    }
};
