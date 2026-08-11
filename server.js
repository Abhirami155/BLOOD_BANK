const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const path = require('path');
const dotenv = require('dotenv');
const pool = require('./config/db');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// MySQL-backed session store — survives server restarts
const sessionStore = new MySQLStore({
    host: process.env.DB_HOST,
    port: 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    createDatabaseTable: true,    // auto-creates sessions table
    expiration: 1000 * 60 * 60 * 24, // 24 hours
    clearExpired: true,
    checkExpirationInterval: 1000 * 60 * 60 // clean up every hour
});

// Logging Middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session management — stored in MySQL
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
}));

// Placeholder Routes
app.get('/', (req, res) => {
    if (req.session.user) {
        return res.redirect(`/${req.session.user.role}/dashboard`);
    }
    res.render('index');
});

// Authentication Routes
const authRoutes = require('./routes/auth');
app.use('/auth', authRoutes);

// Protected Dashboard Routes
const adminRoutes = require('./routes/admin');
const hospitalRoutes = require('./routes/hospital');
const doctorRoutes = require('./routes/doctor');
const donorRoutes = require('./routes/donor');
const patientRoutes = require('./routes/patient');
const commonRoutes = require('./routes/common');
const apiRoutes = require('./routes/api');

app.use('/admin', adminRoutes);
app.use('/hospital', hospitalRoutes);
app.use('/doctor', doctorRoutes);
app.use('/donor', donorRoutes);
app.use('/patient', patientRoutes);
app.use('/common', commonRoutes);
app.use('/api', apiRoutes);

// Global error handler — return JSON for AJAX requests
app.use((err, req, res, next) => {
    console.error('[Server Error]', err.message, err.stack);
    const isAjax = req.headers['accept'] === 'application/json' || req.headers['content-type'] === 'application/json';
    if (isAjax) {
        return res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
    }
    res.status(500).send('Internal Server Error: ' + err.message);
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});