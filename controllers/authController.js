const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

let testAccount;
let transporter;

async function getTransporter() {
    if (!transporter) {
        testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
            host: "smtp.ethereal.email",
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass,
            },
        });
    }
    return transporter;
}

exports.getLogin = (req, res) => {
    res.render('auth/login', { error: null, hint: null, inactiveUser: null, reactivationRequest: null });
};

exports.postLogin = async (req, res) => {
    const { email, password } = req.body;
    try {
        const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) {
            return res.render('auth/login', { error: 'Invalid email or password', hint: null, inactiveUser: null, reactivationRequest: null });
        }
        const user = rows[0];
        
        // Block Deactivated Accounts
        if (user.status === 'inactive') {
            // Check for the latest reactivation request
            const [reactivationRows] = await pool.execute(
                'SELECT status, rejection_reason FROM reactivation_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
                [user.id]
            );
            
            let reactivationRequest = null;
            if (reactivationRows.length > 0) {
                reactivationRequest = reactivationRows[0];
            }

            return res.render('auth/login', { 
                error: 'Account Inactive', 
                hint: 'Your account is currently inactive.',
                inactiveUser: { id: user.id, role: user.role },
                reactivationRequest: reactivationRequest
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.render('auth/login', { 
                error: 'Invalid email or password', 
                hint: 'Tip: Ensure Caps Lock is off, or try resetting your password.',
                inactiveUser: null,
                reactivationRequest: null
            });
        }
        
        // Success
        req.session.user = { id: user.id, email: user.email, role: user.role };
        res.redirect(`/${user.role}/dashboard`);
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
};

exports.getRegister = async (req, res) => {
    try {
        const [hospitals] = await pool.execute('SELECT id, name FROM hospitals');
        const [doctors] = await pool.execute('SELECT d.id, d.name, d.hospital_id FROM doctors d');
        res.render('auth/register', { error: null, hospitals, doctors });
    } catch (err) {
        console.error(err);
        res.render('auth/register', { error: 'Failed to load registration data', hospitals: [], doctors: [] });
    }
};

exports.postRegister = async (req, res) => {
    const { name, email, password, role, password_hint, ...otherDetails } = req.body;
    let hospitals = [];
    let doctors = [];
    try {
        const [hRows] = await pool.execute('SELECT id, name FROM hospitals');
        hospitals = hRows;
        const [dRows] = await pool.execute('SELECT d.id, d.name, d.hospital_id FROM doctors d');
        doctors = dRows;
    } catch (err) {
        console.error('Failed to pre-fetch hospitals/doctors:', err);
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const hashedPassword = await bcrypt.hash(password, 10);
        const [userResult] = await connection.execute(
            'INSERT INTO users (email, password, role, password_hint) VALUES (?, ?, ?, ?)',
            [email, hashedPassword, role, password_hint || null]
        );
        const userId = userResult.insertId;
        
        if (role === 'admin') {
            const { admin_id, admin_key, contact } = otherDetails;
            if (admin_key !== process.env.ADMIN_ACCESS_KEY) {
                throw new Error('Invalid Admin Authorization Code');
            }
            await connection.execute(
                'INSERT INTO admins (user_id, admin_id, name, contact) VALUES (?, ?, ?, ?)',
                [userId, admin_id, name, contact]
            );
        } else if (role === 'donor') {
            const { blood_group, dob, address, contact, age } = otherDetails;
            await connection.execute(
                'INSERT INTO donors (user_id, name, blood_group, dob, address, contact, age, registration_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [userId, name, blood_group, dob, address, contact, age, 'pending']
            );
        } else if (role === 'hospital') {
            const { address, city, contact } = otherDetails;
            await connection.execute(
                'INSERT INTO hospitals (user_id, name, address, city, contact) VALUES (?, ?, ?, ?, ?)',
                [userId, name, address, city, contact]
            );
        } else if (role === 'doctor') {
            // Destructure specifically from req.body or otherDetails
            const hospitalId = otherDetails.hospital_id || null;
            const specialization = otherDetails.specialization || 'General';
            const contact = otherDetails.contact || '';
            
            await connection.execute(
                'INSERT INTO doctors (user_id, hospital_id, name, specialization, contact) VALUES (?, ?, ?, ?, ?)',
                [userId, hospitalId, name, specialization, contact]
            );
        } else if (role === 'patient') {
            const hospital_id = otherDetails.hospital_id || null;
            const doctor_id = otherDetails.doctor_id || null;
            const age = otherDetails.age || 0;
            const gender = otherDetails.gender || 'Other';
            const blood_group = otherDetails.blood_group || 'O+';
            const contact = otherDetails.contact || '';
            await connection.execute(
                'INSERT INTO patients (user_id, hospital_id, doctor_id, name, age, gender, blood_group, contact) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [userId, hospital_id, doctor_id, name, age, gender, blood_group, contact]
            );
        }
        
        // Descriptive Logging
        let logDesc = '';
        let target = '';
        if (role === 'donor') {
            logDesc = `New donor ${name} registered`;
            target = `Donor ${name}`;
        } else if (role === 'hospital') {
            logDesc = `New hospital ${name} registered`;
            target = `Hospital ${name}`;
        } else if (role === 'doctor') {
            const [hName] = await connection.execute('SELECT name FROM hospitals WHERE id = ?', [otherDetails.hospital_id]);
            logDesc = `Doctor ${name} joined ${hName[0]?.name || 'a hospital'}`;
            target = `Doctor ${name}`;
        } else if (role === 'patient') {
            const [hName] = await connection.execute('SELECT name FROM hospitals WHERE id = ?', [otherDetails.hospital_id]);
            logDesc = `Patient ${name} registered under ${hName[0]?.name || 'a hospital'}`;
            target = `Patient ${name}`;
        } else if (role === 'admin') {
            logDesc = `New admin ${name} registered`;
            target = `Admin ${name}`;
        }

        if (logDesc) {
            await logger.logActivity({
                actor_name: name,
                actor_role: role,
                action_type: 'Registered',
                description: logDesc,
                target: target,
                hospital_id: otherDetails.hospital_id || null
            });
        }

        await connection.commit();
        res.redirect('/auth/login?registered=true');
    } catch (err) {
        if (connection) await connection.rollback();
        console.error(err);
        res.render('auth/register', { error: 'Registration failed: ' + err.message, hospitals, doctors });
    } finally {
        connection.release();
    }
};

exports.getPasswordHint = async (req, res) => {
    const { email } = req.body;
    try {
        const [rows] = await pool.execute('SELECT password_hint FROM users WHERE email = ?', [email]);
        if (rows.length === 0) {
            return res.json({ success: false, message: 'User not found' });
        }
        const user = rows[0];
        if (!user.password_hint) {
            return res.json({ success: true, hint: 'No password hint was set for this account.' });
        }
        res.json({ success: true, hint: user.password_hint });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: 'An error occurred while fetching the password hint.' });
    }
};

exports.logout = (req, res) => {
    req.session.destroy();
    res.redirect('/auth/login');
};
