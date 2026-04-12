const pool = require('../config/db');

exports.getDashboard = async (req, res) => {
    try {
        const [requests] = await pool.execute('SELECT r.*, h.name as hospital_name FROM requests r JOIN hospitals h ON r.hospital_id = h.id WHERE r.requester_id = ? ORDER BY r.created_at DESC', [req.session.user.id]);
        
        // Also get all hospitals for the search filter
        const [hospitals] = await pool.execute('SELECT * FROM hospitals');

        res.render('patient/dashboard', {
            user: req.session.user,
            requests,
            hospitals,
            searchResults: null
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Patient Dashboard Error');
    }
};

exports.searchBlood = async (req, res) => {
    const { blood_group, city } = req.body;
    try {
        const query = `
            SELECT bi.*, h.name as hospital_name, h.city, h.contact 
            FROM blood_inventory bi 
            JOIN hospitals h ON bi.hospital_id = h.id 
            WHERE bi.blood_group = ? AND h.city LIKE ? AND bi.quantity > 0
        `;
        const [results] = await pool.execute(query, [blood_group, `%${city}%`]);
        
        const [requests] = await pool.execute('SELECT r.*, h.name as hospital_name FROM requests r JOIN hospitals h ON r.hospital_id = h.id WHERE r.requester_id = ? ORDER BY r.created_at DESC', [req.session.user.id]);
        const [hospitals] = await pool.execute('SELECT * FROM hospitals');

        res.render('patient/dashboard', {
            user: req.session.user,
            requests,
            hospitals,
            searchResults: results,
            searchQuery: { blood_group, city }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Search Error');
    }
};

exports.createRequest = async (req, res) => {
    const { hospital_id, blood_group, quantity, urgency } = req.body;
    try {
        await pool.execute(
            'CALL sp_create_blood_request(?, ?, ?, ?, ?, ?, ?)',
            [req.session.user.id, null, null, hospital_id, blood_group, quantity, urgency]
        );
        res.redirect('/patient/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Request Creation Error');
    }
};

exports.getRequests = async (req, res) => {
    res.redirect('/patient/dashboard#requests');
};
