const bcrypt = require('bcryptjs');
const pool = require('../config/db');

exports.getLogin = (req, res) => {
    res.render('auth/login', { error: null });
};

exports.postLogin = async (req, res) => {
    const { email, password } = req.body;
    try {
        const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) {
            return res.render('auth/login', { error: 'Invalid email or password' });
        }
        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.render('auth/login', { error: 'Invalid email or password' });
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
        res.render('auth/register', { error: null, hospitals });
    } catch (err) {
        console.error(err);
        res.render('auth/register', { error: 'Failed to load registration data', hospitals: [] });
    }
};

exports.postRegister = async (req, res) => {
    const { name, email, password, role, ...otherDetails } = req.body;
    let hospitals = [];
    try {
        const [hRows] = await pool.execute('SELECT id, name FROM hospitals');
        hospitals = hRows;
    } catch (err) {
        console.error('Failed to pre-fetch hospitals:', err);
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const hashedPassword = await bcrypt.hash(password, 10);
        const [userResult] = await connection.execute(
            'INSERT INTO users (email, password, role) VALUES (?, ?, ?)',
            [email, hashedPassword, role]
        );
        const userId = userResult.insertId;
        
        if (role === 'donor') {
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
            // Patient user role currently just has the user entry, 
            // but we can add more details here if needed.
        }
        
        await connection.commit();
        res.redirect('/auth/login?registered=true');
    } catch (err) {
        if (connection) await connection.rollback();
        console.error(err);
        res.render('auth/register', { error: 'Registration failed: ' + err.message, hospitals });
    } finally {
        connection.release();
    }
};

exports.logout = (req, res) => {
    req.session.destroy();
    res.redirect('/auth/login');
};
