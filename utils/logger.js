const pool = require('../config/db');

/**
 * Logs a descriptive activity to the audit_logs table.
 * @param {Object} data - Log data
 * @param {string} data.actor_name - Name of the person/facility performing the action
 * @param {string} data.actor_role - Role (admin, hospital, doctor, donor, patient)
 * @param {string} data.action_type - Type of action (e.g., 'Raised blood request')
 * @param {string} data.description - Descriptive message
 * @param {string} data.target - Entity being affected (e.g., 'Patient Jane Doe')
 * @param {number} [data.hospital_id] - Optional hospital context
 */
exports.logActivity = async (data) => {
    try {
        let { actor_name, actor_role, action_type, description, target, hospital_id } = data;

        // Fix Doctor Name Prefix (Prevent "Dr. Dr. Smith")
        if (actor_role === 'doctor' && actor_name) {
            if (actor_name.toLowerCase().startsWith('dr.')) {
                actor_name = actor_name.substring(3).trim();
            }
            actor_name = 'Dr. ' + actor_name;
        }

        await pool.execute(
            `INSERT INTO audit_logs (actor_name, actor_role, action_type, description, target, hospital_id, table_name, record_id) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                actor_name, 
                actor_role, 
                action_type, 
                description, 
                target || 'N/A', 
                hospital_id || null,
                'Descriptive', // placeholder for old table_name column
                0              // placeholder for old record_id column
            ]
        );
    } catch (err) {
        console.error('Audit Logging Error:', err);
    }
};
