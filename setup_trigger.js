const pool = require('./config/db');

async function setupTrigger() {
    try {
        await pool.query('DROP TRIGGER IF EXISTS after_user_delete');
        await pool.query(`
            CREATE TRIGGER after_user_delete AFTER DELETE ON users FOR EACH ROW 
            BEGIN 
                INSERT INTO audit_logs (action_type, table_name, record_id, details) 
                VALUES ('DELETE', 'users', OLD.id, CONCAT('User account deleted with role: ', OLD.role)); 
            END
        `);
        console.log('Trigger created successfully');
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
setupTrigger();
