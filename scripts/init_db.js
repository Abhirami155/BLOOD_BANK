const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function executeSqlFile(connection, filePath) {
    let sql = fs.readFileSync(filePath, 'utf8');
    
    const statements = [];
    const delimiterRegex = /DELIMITER\s+(\S+)/g;
    let currentDelimiter = ';';
    let lastIndex = 0;
    let match;

    while ((match = delimiterRegex.exec(sql)) !== null) {
        // Handle text before the DELIMITER command
        const segment = sql.substring(lastIndex, match.index);
        if (segment.trim()) {
            statements.push(...segment.split(currentDelimiter).map(s => s.trim()).filter(Boolean));
        }
        
        // Update the current delimiter
        currentDelimiter = match[1];
        lastIndex = delimiterRegex.lastIndex;
    }

    // Handle the final segment
    const finalSegment = sql.substring(lastIndex);
    if (finalSegment.trim()) {
        statements.push(...finalSegment.split(currentDelimiter).map(s => s.trim()).filter(Boolean));
    }

    for (let statement of statements) {
        // Clean up individual statements
        statement = statement.replace(/DELIMITER\s+\S+/g, '').trim(); 
        if (statement) {
            console.log('▶ Executing:', statement.substring(0, 50) + '...');
            await connection.query(statement);
        }
    }

}


async function init() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || ''
    });

    console.log('🔗 Connected to MySQL server.');

    try {
        console.log('🗑️ Dropping existing database if any...');
        await connection.query(`DROP DATABASE IF EXISTS blood_bank_db`);
        
        console.log('🔨 Creating database blood_bank_db...');
        await connection.query(`CREATE DATABASE blood_bank_db`);
        await connection.query(`USE blood_bank_db`);

        // Get a new connection to the specific database
        const dbConnection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: 'blood_bank_db'
        });

        console.log('📖 Running schema.sql...');
        await executeSqlFile(dbConnection, path.join(__dirname, '../database/schema.sql'));
        
        console.log('🌱 Seeding sample data...');
        await executeSqlFile(dbConnection, path.join(__dirname, '../database/seed.sql'));

        console.log('✅ Database setup complete!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error initializing database:', err.message);
        process.exit(1);
    }
}

init();

