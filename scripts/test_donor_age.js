const pool = require('../config/db');

async function verifyAgeConstraint() {
    console.log('🧪 Testing Donor Age CHECK Constraint...');
    
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        
        // 1. Create a user first (needed due to FK)
        const [userResult] = await connection.execute(
            'INSERT INTO users (email, password, role) VALUES (?, ?, ?)',
            ['test_underage@test.com', 'password123', 'donor']
        );
        const userId = userResult.insertId;

        // 2. Attempt to insert donor with age 17 (Should FAIL)
        console.log('\n   Scenario: Inserting Donor with Age 17 (Expect Violation)...');
        try {
            await connection.execute(
                'INSERT INTO donors (user_id, name, blood_group, dob, address, contact, age, registration_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [userId, 'Underage Donor', 'A+', '2009-01-01', 'Test Address', '1234567890', 17, 'pending']
            );
            console.log('❌ Error: Underage donor was incorrectly accepted!');
        } catch (err) {
            if (err.message.includes('chk_donor_age')) {
                console.log('✅ Success: Correctly blocked underage donor with error:', err.message);
            } else {
                console.log('❓ Unexpected Error:', err.message);
            }
        }

        // 3. Attempt to insert donor with age 18 (Should SUCCEED)
        console.log('\n   Scenario: Inserting Donor with Age 18 (Expect Success)...');
        try {
            await connection.execute(
                'INSERT INTO donors (user_id, name, blood_group, dob, address, contact, age, registration_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [userId, 'Eligible Donor', 'A+', '2008-01-01', 'Test Address', '1234567890', 18, 'pending']
            );
            console.log('✅ Success: Eligible donor accepted!');
        } catch (err) {
            console.log('❌ Error: Eligible donor was rejected:', err.message);
        }

        await connection.rollback(); // Cleanup test data
        console.log('\n🏆 Verification tests completed!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Test script error:', err);
        process.exit(1);
    } finally {
        connection.release();
    }
}

verifyAgeConstraint();
