const pool = require('../config/db');

async function verifyAudit() {
    console.log('🔍 Verifying New Audit Triggers...');

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Test Hospital Update Audit
        console.log('\n1. Testing Hospital Update Audit...');
        await connection.execute('UPDATE hospitals SET contact = "9999999999" WHERE id = 1');
        
        // 2. Test Inventory Update Audit
        console.log('2. Testing Inventory Update Audit...');
        await connection.execute('UPDATE blood_inventory SET quantity = quantity + 10 WHERE id = 1');

        // 3. Test Request Status Update Audit
        console.log('3. Testing Request Status Update Audit...');
        await connection.execute('UPDATE requests SET status = "rejected" WHERE id = 1');

        await connection.commit();

        console.log('\n📊 Checking Audit Logs...');
        const [logs] = await pool.execute('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 5');
        
        logs.forEach(log => {
            console.log(`- [${log.table_name}] ${log.action_type}: ${log.details}`);
        });

        const hospitalLog = logs.find(l => l.table_name === 'hospitals');
        const inventoryLog = logs.find(l => l.table_name === 'blood_inventory');
        const requestLog = logs.find(l => l.table_name === 'requests');

        if (hospitalLog && inventoryLog && requestLog) {
            console.log('\n✅ All new audit triggers are working correctly!');
        } else {
            console.log('\n❌ Some audit triggers missed.');
        }

        process.exit(0);
    } catch (err) {
        console.error('❌ Audit verification failed:', err);
        process.exit(1);
    } finally {
        connection.release();
    }
}

verifyAudit();
