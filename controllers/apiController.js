const pool = require('../config/db');
const logger = require('../utils/logger');

exports.deleteAccount = async (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const userId = req.session.user.id;
    const role = req.session.user.role;

    if (role === 'donor' || role === 'hospital' || role === 'doctor') {
        return res.status(403).json({ success: false, message: 'Account deletion is disabled for your role to preserve clinical and contribution history. Please contact Admin to deactivate your account.' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. All roles: Delete requests where they are the requester
        await connection.execute('DELETE FROM requests WHERE requester_id = ?', [userId]);

        // 2. Role-specific cleanup for tables without CASCADE DELETE
        if (role === 'donor') {
            await connection.execute(`
                DELETE FROM donations WHERE donor_id = (SELECT id FROM donors WHERE user_id = ?)
            `, [userId]);
        } else if (role === 'doctor') {
            await connection.execute(`
                DELETE FROM requests WHERE doctor_id = (SELECT id FROM doctors WHERE user_id = ?)
            `, [userId]);
        } else if (role === 'hospital') {
            // Delete donations directed to this hospital
            await connection.execute(`
                DELETE FROM donations WHERE hospital_id = (SELECT id FROM hospitals WHERE user_id = ?)
            `, [userId]);
            // Delete requests directed to this hospital
            await connection.execute(`
                DELETE FROM requests WHERE hospital_id = (SELECT id FROM hospitals WHERE user_id = ?)
            `, [userId]);
            // Delete requests for patients in this hospital
            await connection.execute(`
                DELETE FROM requests WHERE patient_id IN (SELECT id FROM patients WHERE hospital_id = (SELECT id FROM hospitals WHERE user_id = ?))
            `, [userId]);
        }

        // 3. Extract name for logging before deletion
        let userName = 'User';
        const [uRow] = await connection.execute(`
            SELECT 
                CASE 
                    WHEN ? = 'donor' THEN (SELECT name FROM donors WHERE user_id = ?)
                    WHEN ? = 'hospital' THEN (SELECT name FROM hospitals WHERE user_id = ?)
                    WHEN ? = 'doctor' THEN (SELECT name FROM doctors WHERE user_id = ?)
                    WHEN ? = 'patient' THEN (SELECT name FROM patients WHERE user_id = ?)
                    ELSE 'Admin'
                END as name
        `, [role, userId, role, userId, role, userId, role, userId]);
        if (uRow.length > 0 && uRow[0].name) userName = uRow[0].name;

        await logger.logActivity({
            actor_name: userName,
            actor_role: role,
            action_type: 'Deleted account',
            description: `${userName} deleted their account`,
            target: `Account ${userName}`
        });

        // 4. Delete the main user record.
        await connection.execute('DELETE FROM users WHERE id = ?', [userId]);

        await connection.commit();
        
        // Destroy the session
        req.session.destroy();

        res.json({ success: true, message: 'Account deleted successfully' });
    } catch (err) {
        await connection.rollback();
        console.error('Error deleting account:', err);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    } finally {
        connection.release();
    }
};

exports.requestDeactivation = async (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { reason } = req.body;
    const userId = req.session.user.id;
    const role = req.session.user.role;

    try {
        // Check for existing pending request
        const [existing] = await pool.execute(
            'SELECT id FROM deactivation_requests WHERE user_id = ? AND status = "pending"',
            [userId]
        );
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'You already have a pending deactivation request.' });
        }

        // Get name for logging
        let userName = 'User';
        const [nameRow] = await pool.execute(`
            SELECT name FROM ${role}s WHERE user_id = ?
        `, [userId]);
        if (nameRow.length > 0) userName = nameRow[0].name;

        // Insert request
        await pool.execute(
            'INSERT INTO deactivation_requests (user_id, role, reason, status) VALUES (?, ?, ?, ?)',
            [userId, role, reason || '', 'pending']
        );

        // Log activity
        await logger.logActivity({
            actor_name: userName,
            actor_role: role,
            action_type: 'Requested deactivation',
            description: `${role.charAt(0).toUpperCase() + role.slice(1)} ${userName} requested account deactivation`,
            target: `Account ${userName}`
        });

        res.json({ success: true });
    } catch (err) {
        console.error('Request Deactivation Error:', err);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

exports.requestReactivation = async (req, res) => {
    const { userId, role, reason } = req.body;

    try {
        // Check for existing pending request
        const [existing] = await pool.execute(
            'SELECT id FROM reactivation_requests WHERE user_id = ? AND status = "pending"',
            [userId]
        );
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'You already have a pending reactivation request.' });
        }

        // Get name for logging
        let userName = 'User';
        const [nameRow] = await pool.execute(`
            SELECT name FROM ${role}s WHERE user_id = ?
        `, [userId]);
        if (nameRow.length > 0) userName = nameRow[0].name;

        // Insert request
        await pool.execute(
            'INSERT INTO reactivation_requests (user_id, role, reason, status) VALUES (?, ?, ?, ?)',
            [userId, role, reason || '', 'pending']
        );

        // Log activity
        await logger.logActivity({
            actor_name: userName,
            actor_role: role,
            action_type: 'Requested reactivation',
            description: `${role.charAt(0).toUpperCase() + role.slice(1)} ${userName} requested account reactivation`,
            target: `Account ${userName}`
        });

        res.json({ success: true });
    } catch (err) {
        console.error('Request Reactivation Error:', err);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

exports.getHospitalDetails = async (req, res) => {
    const { id } = req.params;
    try {
        const [hRow] = await pool.execute(`
            SELECT h.*, u.email, u.status 
            FROM hospitals h 
            JOIN users u ON h.user_id = u.id 
            WHERE h.id = ?
        `, [id]);
        
        if (hRow.length === 0) {
            return res.status(404).json({ error: 'Hospital record not found' });
        }
        
        const hId = hRow[0].id;
        const details = { ...hRow[0] };

        // Sub-queries with default fallbacks
        try {
            const [inventory] = await pool.execute('SELECT blood_group, quantity FROM blood_inventory WHERE hospital_id = ?', [hId]);
            details.inventory = inventory;
        } catch (e) { details.inventory = []; }

        try {
            const [doctors] = await pool.execute('SELECT COUNT(*) as count FROM doctors WHERE hospital_id = ?', [hId]);
            details.doctorCount = doctors[0].count;
        } catch (e) { details.doctorCount = 0; }

        try {
            const [patients] = await pool.execute('SELECT COUNT(*) as count FROM patients WHERE hospital_id = ?', [hId]);
            details.patientCount = patients[0].count;
        } catch (e) { details.patientCount = 0; }

        try {
            const [requests] = await pool.execute('SELECT status, COUNT(*) as count FROM requests WHERE hospital_id = ? GROUP BY status', [hId]);
            details.requestStats = requests;
        } catch (e) { details.requestStats = []; }

        try {
            const [donors] = await pool.execute('SELECT COUNT(DISTINCT donor_id) as count FROM donations WHERE hospital_id = ?', [hId]);
            details.donorCount = donors[0].count;
        } catch (e) { details.donorCount = 0; }

        res.json(details);
    } catch (err) {
        console.error('getHospitalDetails Error:', err);
        res.status(500).json({ error: 'Unable to load hospital details. Please retry.' });
    }
};
