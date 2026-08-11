const pool = require('../config/db');
const logger = require('../utils/logger');

exports.getDashboard = async (req, res) => {
    try {
        // Core Counts
        const [hospitals] = await pool.execute('SELECT COUNT(*) as count FROM hospitals');
        const [donors] = await pool.execute('SELECT COUNT(*) as count FROM donors');
        const [doctors] = await pool.execute('SELECT COUNT(*) as count FROM doctors');
        const [patients] = await pool.execute('SELECT COUNT(*) as count FROM patients');
        const [activeRequests] = await pool.execute('SELECT COUNT(*) as count FROM requests WHERE status IN ("pending", "approved", "processing")');
        
        // Analytics
        const [emergencyToday] = await pool.execute('SELECT COUNT(*) as count FROM requests WHERE urgency IN ("emergency", "critical") AND DATE(created_at) = CURDATE()');
        const [rejectedCount] = await pool.execute('SELECT COUNT(*) as count FROM requests WHERE status = "rejected"');
        const [approvedCount] = await pool.execute('SELECT COUNT(*) as count FROM requests WHERE status = "approved"');
        const [lowStockHospitals] = await pool.execute('SELECT COUNT(DISTINCT hospital_id) as count FROM blood_inventory WHERE quantity < 5');

        // Inventory Breakdown
        const [hospitalStock] = await pool.execute(`
            SELECT h.name as hospital_name, bi.blood_group, bi.quantity 
            FROM blood_inventory bi 
            JOIN hospitals h ON bi.hospital_id = h.id 
            ORDER BY h.name, bi.blood_group
        `);

        // Critical Alerts
        const [criticalRequests] = await pool.execute(`
            SELECT r.*, h.name as hospital_name, p.name as patient_name 
            FROM requests r 
            JOIN hospitals h ON r.hospital_id = h.id 
            JOIN patients p ON r.patient_id = p.id
            WHERE r.urgency = 'critical' AND r.status = 'pending'
        `);
        const [lowStockAlerts] = await pool.execute(`
            SELECT h.name as hospital_name, bi.blood_group, bi.quantity 
            FROM blood_inventory bi 
            JOIN hospitals h ON bi.hospital_id = h.id 
            WHERE bi.quantity < 5
        `);

        // Global Stock
        const [stock] = await pool.execute('SELECT blood_group, SUM(quantity) as total FROM blood_inventory GROUP BY blood_group');
        
        // Pending Donors
        const [pendingDonors] = await pool.execute('SELECT * FROM donors WHERE registration_status = "pending"');

        // Recent Requests with filtering data (passing all for now, filter logic in frontend or separate route)
        const [recentRequests] = await pool.execute(
            `SELECT r.*, 
                    h.name AS hospital_name,
                    d.name AS doctor_name,
                    p.name AS patient_name
             FROM requests r
             JOIN hospitals h ON r.hospital_id = h.id
             LEFT JOIN doctors d ON r.doctor_id = d.id
             LEFT JOIN patients p ON r.patient_id = p.id
             ORDER BY r.created_at DESC LIMIT 15`
        );

        // Activity Log
        const [activityLogs] = await pool.execute('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10');

        // Deactivation Requests
        const [deactivationRequests] = await pool.execute(`
            SELECT dr.*, u.email 
            FROM deactivation_requests dr 
            JOIN users u ON dr.user_id = u.id 
            WHERE dr.status = 'pending'
            ORDER BY dr.created_at DESC
        `);

        // Fetch names for these requests
        for (let req of deactivationRequests) {
            const [nameRow] = await pool.execute(`SELECT name FROM ${req.role}s WHERE user_id = ?`, [req.user_id]);
            req.name = nameRow.length > 0 ? nameRow[0].name : 'User';
        }

        // Reactivation Requests
        const [reactivationRequests] = await pool.execute(`
            SELECT rr.*, u.email 
            FROM reactivation_requests rr 
            JOIN users u ON rr.user_id = u.id 
            WHERE rr.status = 'pending'
            ORDER BY rr.created_at DESC
        `);

        for (let req of reactivationRequests) {
            const [nameRow] = await pool.execute(`SELECT name FROM ${req.role}s WHERE user_id = ?`, [req.user_id]);
            req.name = nameRow.length > 0 ? nameRow[0].name : 'User';
        }

        // Lists for Filters
        const [hospitalList] = await pool.execute('SELECT id, name FROM hospitals');

        res.render('admin/dashboard', {
            user: req.session.user,
            stats: {
                hospitals: hospitals[0].count,
                donors: donors[0].count,
                doctors: doctors[0].count,
                patients: patients[0].count,
                activeRequests: activeRequests[0].count,
                emergencyToday: emergencyToday[0].count,
                rejectedCount: rejectedCount[0].count,
                approvedCount: approvedCount[0].count,
                lowStockHospitals: lowStockHospitals[0].count
            },
            hospitalStock,
            criticalRequests,
            lowStockAlerts,
            stock,
            pendingDonors,
            recentRequests,
            activityLogs,
            hospitalList,
            deactivationRequests,
            reactivationRequests
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Admin Dashboard Error');
    }
};

exports.getHospitals = async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT h.*, u.status FROM hospitals h JOIN users u ON h.user_id = u.id');
        res.render('admin/hospitals', { user: req.session.user, hospitals: rows });
    } catch (err) {
        console.error(err);
        res.status(500).send('Admin Hospitals Error');
    }
};

exports.getDoctors = async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT d.*, h.name as hospital_name, u.status 
            FROM doctors d 
            JOIN hospitals h ON d.hospital_id = h.id
            JOIN users u ON d.user_id = u.id
        `);
        res.render('admin/doctors', { user: req.session.user, doctors: rows });
    } catch (err) {
        console.error(err);
        res.status(500).send('Admin Doctors Error');
    }
};

exports.getDonors = async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT d.*, u.status FROM donors d JOIN users u ON d.user_id = u.id');
        res.render('admin/donors', { user: req.session.user, donors: rows });
    } catch (err) {
        console.error(err);
        res.status(500).send('Admin Donors Error');
    }
};

exports.getPatients = async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT p.*, h.name AS hospital_name, d.name AS doctor_name, u.email AS patient_email, u.status 
             FROM patients p 
             JOIN hospitals h ON p.hospital_id = h.id 
             LEFT JOIN doctors d ON p.doctor_id = d.id
             LEFT JOIN users u ON p.user_id = u.id`
        );
        res.render('admin/patients', { user: req.session.user, patients: rows });
    } catch (err) {
        console.error(err);
        res.status(500).send('Admin Patients Error');
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

exports.toggleStatus = async (req, res) => {
    const { userId, newStatus } = req.body;
    try {
        await pool.execute('UPDATE users SET status = ? WHERE id = ?', [newStatus, userId]);
        
        const [uRow] = await pool.execute('SELECT role, email FROM users WHERE id = ?', [userId]);
        const role = uRow[0].role;
        
        let name = 'User';
        const [nameRow] = await pool.execute(`
            SELECT name FROM ${role}s WHERE user_id = ?
        `, [userId]);
        if (nameRow.length > 0) name = nameRow[0].name;

        await logger.logActivity({
            actor_name: 'Admin',
            actor_role: 'admin',
            action_type: newStatus === 'inactive' ? 'Deactivated account' : 'Reactivated account',
            description: `Admin ${newStatus === 'inactive' ? 'deactivated' : 'reactivated'} ${role} account for ${name}`,
            target: `${role.charAt(0).toUpperCase() + role.slice(1)} ${name}`
        });

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
};

exports.deleteUser = async (req, res) => {
    const { userId } = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        
        const [uRow] = await connection.execute('SELECT role, email FROM users WHERE id = ?', [userId]);
        const { role, email } = uRow[0];
        
        if (role === 'hospital' || role === 'doctor' || role === 'donor') {
            await connection.rollback();
            return res.status(403).json({ success: false, message: `${role.charAt(0).toUpperCase() + role.slice(1)}s cannot be deleted due to referential integrity constraints. Use Deactivate instead.` });
        }
        
        let name = 'User';
        const [nameRow] = await connection.execute(`SELECT name FROM ${role}s WHERE user_id = ?`, [userId]);
        if (nameRow.length > 0) name = nameRow[0].name;

        // Archive
        await connection.execute(
            'INSERT INTO deleted_users (user_id, email, role, name, reason) VALUES (?, ?, ?, ?, ?)',
            [userId, email, role, name, 'Admin permanent deletion']
        );

        // Delete from users (CASCADE handles role tables)
        await connection.execute('DELETE FROM users WHERE id = ?', [userId]);

        await logger.logActivity({
            actor_name: 'Admin',
            actor_role: 'admin',
            action_type: 'Deleted account',
            description: `Admin deleted ${role} account for ${name}`,
            target: `${role.charAt(0).toUpperCase() + role.slice(1)} ${name}`
        });

        await connection.commit();
        res.json({ success: true });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ success: false });
    } finally {
        connection.release();
    }
};

exports.getDetails = async (req, res) => {
    const { targetId, role } = req.params;
    console.log(`[AdminAudit] Fetching details for role: ${role}, ID: ${targetId}`);
    
    try {
        let details = {};
        if (role === 'donor') {
            const [row] = await pool.execute('SELECT * FROM donors WHERE user_id = ?', [targetId]);
            if (row.length === 0) return res.status(404).json({ error: 'Donor record not found' });
            const [history] = await pool.execute('SELECT * FROM donations WHERE donor_id = ?', [row[0].id]);
            details = { ...row[0], history };
        } else if (role === 'doctor') {
            const [row] = await pool.execute('SELECT d.*, h.name as hospital_name FROM doctors d JOIN hospitals h ON d.hospital_id = h.id WHERE d.user_id = ?', [targetId]);
            if (row.length === 0) return res.status(404).json({ error: 'Doctor record not found' });
            details = row[0];
        } else if (role === 'patient') {
            const [row] = await pool.execute(
                `SELECT p.*, h.name as hospital_name, d.name as doctor_name 
                 FROM patients p 
                 JOIN hospitals h ON p.hospital_id = h.id 
                 LEFT JOIN doctors d ON p.doctor_id = d.id 
                 WHERE p.user_id = ?`,
                [targetId]
            );
            if (row.length === 0) return res.status(404).json({ error: 'Patient record not found' });
            const [history] = await pool.execute('SELECT * FROM requests WHERE patient_id = ?', [row[0].id]);
            details = { ...row[0], history };
        } else if (role === 'hospital') {
            // targetId is the Hospital PK 'id'
            const [hRow] = await pool.execute(`
                SELECT h.*, u.email, u.status 
                FROM hospitals h 
                JOIN users u ON h.user_id = u.id 
                WHERE h.id = ?
            `, [targetId]);
            
            if (hRow.length === 0) {
                console.error(`[AdminAudit] Hospital ID ${targetId} not found`);
                return res.status(404).json({ error: 'Hospital record not found' });
            }
            
            const hId = hRow[0].id;
            details = { ...hRow[0] };

            // Sub-queries with individual error handling to prevent total failure
            try {
                const [inventory] = await pool.execute('SELECT blood_group, quantity FROM blood_inventory WHERE hospital_id = ?', [hId]);
                details.inventory = inventory;
            } catch (e) { console.error('Inventory Fetch Error:', e); details.inventory = []; }

            try {
                const [doctors] = await pool.execute('SELECT COUNT(*) as count FROM doctors WHERE hospital_id = ?', [hId]);
                details.doctorCount = doctors[0].count;
            } catch (e) { console.error('Doctor Count Error:', e); details.doctorCount = 0; }

            try {
                const [patients] = await pool.execute('SELECT COUNT(*) as count FROM patients WHERE hospital_id = ?', [hId]);
                details.patientCount = patients[0].count;
            } catch (e) { console.error('Patient Count Error:', e); details.patientCount = 0; }

            try {
                const [requests] = await pool.execute('SELECT status, COUNT(*) as count FROM requests WHERE hospital_id = ? GROUP BY status', [hId]);
                details.requestStats = requests;
            } catch (e) { console.error('Request Stats Error:', e); details.requestStats = []; }

            try {
                const [donors] = await pool.execute('SELECT COUNT(DISTINCT donor_id) as count FROM donations WHERE hospital_id = ?', [hId]);
                details.donorCount = donors[0].count;
            } catch (e) { console.error('Donor Count Error:', e); details.donorCount = 0; }
        }
        
        console.log(`[AdminAudit] Successfully retrieved details for ${role} ID ${targetId}`);
        res.json(details);
    } catch (err) {
        console.error(`[AdminAudit] CRITICAL ERROR for ${role} ID ${targetId}:`, err);
        res.status(500).json({ error: 'Unable to load details. Please retry.' });
    }
};

exports.approveDonor = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.execute('UPDATE donors SET registration_status = "approved" WHERE id = ?', [id]);
        
        const [donorRow] = await pool.execute('SELECT name FROM donors WHERE id = ?', [id]);
        await logger.logActivity({
            actor_name: 'Admin',
            actor_role: 'admin',
            action_type: 'Approved donor',
            description: `Admin approved donor registration for ${donorRow[0].name}`,
            target: `Donor ${donorRow[0].name}`
        });

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
        
        const [donorRow] = await pool.execute('SELECT name FROM donors WHERE id = ?', [id]);
        await logger.logActivity({
            actor_name: 'Admin',
            actor_role: 'admin',
            action_type: 'Rejected donor',
            description: `Admin rejected donor registration for ${donorRow[0].name}`,
            target: `Donor ${donorRow[0].name}`
        });

        res.redirect('/admin/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Rejection Error');
    }
};

exports.handleDeactivationRequest = async (req, res) => {
    const { requestId, action } = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [drRow] = await connection.execute('SELECT * FROM deactivation_requests WHERE id = ?', [requestId]);
        if (drRow.length === 0) throw new Error('Request not found');
        const { user_id, role } = drRow[0];

        // Get name
        const [nameRow] = await connection.execute(`SELECT name FROM ${role}s WHERE user_id = ?`, [user_id]);
        const name = nameRow.length > 0 ? nameRow[0].name : 'User';

        if (action === 'approve') {
            // Deactivate user
            await connection.execute('UPDATE users SET status = "inactive" WHERE id = ?', [user_id]);
            await connection.execute('UPDATE deactivation_requests SET status = "approved" WHERE id = ?', [requestId]);

            await logger.logActivity({
                actor_name: 'Admin',
                actor_role: 'admin',
                action_type: 'Approved deactivation',
                description: `Admin approved deactivation for ${role} ${name}`,
                target: `Account ${name}`
            });
        } else {
            // Reject request
            await connection.execute('UPDATE deactivation_requests SET status = "rejected" WHERE id = ?', [requestId]);
            
            await logger.logActivity({
                actor_name: 'Admin',
                actor_role: 'admin',
                action_type: 'Rejected deactivation',
                description: `Admin rejected deactivation request for ${role} ${name}`,
                target: `Account ${name}`
            });
        }

        await connection.commit();
        res.json({ success: true });
    } catch (err) {
        await connection.rollback();
        console.error('Handle Deactivation Error:', err);
        res.status(500).json({ success: false });
    } finally {
        connection.release();
    }
};

exports.handleReactivationRequest = async (req, res) => {
    const { requestId, action, reason } = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [rrRow] = await connection.execute('SELECT * FROM reactivation_requests WHERE id = ?', [requestId]);
        if (rrRow.length === 0) throw new Error('Request not found');
        const { user_id, role } = rrRow[0];

        // Get name
        const [nameRow] = await connection.execute(`SELECT name FROM ${role}s WHERE user_id = ?`, [user_id]);
        const name = nameRow.length > 0 ? nameRow[0].name : 'User';

        if (action === 'approve') {
            // Reactivate user
            await connection.execute('UPDATE users SET status = "active" WHERE id = ?', [user_id]);
            await connection.execute('UPDATE reactivation_requests SET status = "approved" WHERE id = ?', [requestId]);

            await logger.logActivity({
                actor_name: 'Admin',
                actor_role: 'admin',
                action_type: 'Approved reactivation',
                description: `Admin approved reactivation for ${role} ${name}`,
                target: `Account ${name}`
            });
        } else {
            // Reject request
            await connection.execute(
                'UPDATE reactivation_requests SET status = "rejected", rejection_reason = ? WHERE id = ?', 
                [reason || null, requestId]
            );
            
            await logger.logActivity({
                actor_name: 'Admin',
                actor_role: 'admin',
                action_type: 'Rejected reactivation',
                description: `Admin rejected reactivation request for ${role} ${name}${reason ? ` (Reason: ${reason})` : ''}`,
                target: `Account ${name}`
            });
        }

        await connection.commit();
        res.json({ success: true });
    } catch (err) {
        await connection.rollback();
        console.error('Handle Reactivation Error:', err);
        res.status(500).json({ success: false });
    } finally {
        connection.release();
    }
};

exports.getDonations = async (req, res) => {
    try {
        const query = `
            SELECT d.*, dn.name as donor_name, h.name as hospital_name 
            FROM donations d 
            JOIN donors dn ON d.donor_id = dn.id 
            JOIN hospitals h ON d.hospital_id = h.id 
            ORDER BY d.donation_date DESC
        `;
        const [rows] = await pool.execute(query);
        res.render('admin/donations', { user: req.session.user, donations: rows });
    } catch (err) {
        console.error(err);
        res.status(500).send('Admin Donations Error');
    }
};
