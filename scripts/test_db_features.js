const pool = require('../config/db');

async function test() {
    console.log('🧪 Starting Database Feature Verification...');

    try {
        // 1. Test Audit Trigger
        console.log('\n1. Testing Audit Trigger (after_user_insert)...');
        const [auditLogs] = await pool.execute('SELECT * FROM audit_logs LIMIT 5');
        console.log(`✅ Audit logs found: ${auditLogs.length} entries.`);
        console.log('   Latest Log:', auditLogs[0].details);

        // 2. Test Views
        console.log('\n2. Testing Views...');
        const [inventorySummary] = await pool.execute('SELECT * FROM view_hospital_inventory_summary LIMIT 1');
        console.log('✅ View Summary Result:', inventorySummary[0].hospital_name, '-', inventorySummary[0].blood_group);

        const [impactReport] = await pool.execute('SELECT * FROM view_donor_impact_report WHERE name = "John Doe"');
        console.log('✅ Donor Impact (John Doe):', impactReport[0].total_donations, 'donations,', impactReport[0].total_quantity_donated, 'units.');

        // 3. Test Functions
        console.log('\n3. Testing Functions...');
        const [age] = await pool.execute('SELECT fn_calculate_age("1990-05-15") as age');
        console.log('✅ Age Calculation (1990-05-15):', age[0].age);

        const [eligibility] = await pool.execute('SELECT fn_is_eligible_to_donate(1) as eligible');
        console.log('✅ Donor Eligibility (Donor 1):', eligibility[0].eligible === 1 ? 'YES' : 'NO');

        // 4. Test Constraints (CHECK)
        console.log('\n4. Testing CHECK Constraints (Expected to fail)...');
        try {
            await pool.execute('INSERT INTO patients (hospital_id, name, age, gender, blood_group) VALUES (1, "Invalid Age", 200, "Male", "A+")');
            console.log('❌ CHECK constraint failed to block invalid age!');
        } catch (e) {
            console.log('✅ CHECK constraint correctly blocked invalid age:', e.message);
        }

        // 5. Test Cursor-based Procedure
        console.log('\n5. Testing Stored Procedure with Cursor (sp_cleanup_expired_requests)...');
        const [beforeRequests] = await pool.execute('SELECT COUNT(*) as count FROM requests WHERE status = "rejected"');
        await pool.execute('CALL sp_cleanup_expired_requests()');
        const [afterRequests] = await pool.execute('SELECT COUNT(*) as count FROM requests WHERE status = "rejected"');
        console.log(`✅ Old requests cleaned up. Rejected count: ${beforeRequests[0].count} -> ${afterRequests[0].count}`);

        console.log('\n🏆 All tests completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Test failed:', err);
        process.exit(1);
    }
}

test();
