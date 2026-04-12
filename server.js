const express = require('express');
const session = require('express-session');
const path = require('path');
const dotenv = require('dotenv');
const pool = require('./config/db');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

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

// Session management
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Set to true if using HTTPS
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

app.use('/admin', adminRoutes);
app.use('/hospital', hospitalRoutes);
app.use('/doctor', doctorRoutes);
app.use('/donor', donorRoutes);
app.use('/patient', patientRoutes);
app.use('/common', commonRoutes);

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});