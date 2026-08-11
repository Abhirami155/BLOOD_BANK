const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'blood_bank_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test connection
(async () => {
    try {
        const connection = await pool.getConnection();
        console.log('✅ MySQL Connected to blood_bank_db');
        connection.release();
    } catch (err) {
        console.error('❌ Database connection failed:', err.message);
    }
})();

async function setIsolationLevel(connection, level) {
    const validLevels = ['READ UNCOMMITTED', 'READ COMMITTED', 'REPEATABLE READ', 'SERIALIZABLE'];
    if (!validLevels.includes(level)) throw new Error('Invalid isolation level');
    await connection.query(`SET TRANSACTION ISOLATION LEVEL ${level}`);
}

pool.setIsolationLevel = setIsolationLevel;
module.exports = pool;
