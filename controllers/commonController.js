const pool = require('../config/db');

exports.getGlobalStock = async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT bi.*, h.name as hospital_name, h.city FROM blood_inventory bi JOIN hospitals h ON bi.hospital_id = h.id WHERE bi.quantity > 0 ORDER BY h.city');
        res.render('common/stock', { user: req.session.user, stock: rows });
    } catch (err) {
        console.error(err);
        res.status(500).send('Global Stock Error');
    }
};

exports.getSearch = async (req, res) => {
    try {
        const [hospitals] = await pool.execute('SELECT DISTINCT city FROM hospitals');
        res.render('common/search', { user: req.session.user, cities: hospitals, searchResults: null });
    } catch (err) {
        console.error(err);
        res.status(500).send('Search Page Error');
    }
};

exports.postSearch = async (req, res) => {
    let { blood_group, city } = req.body;
    // Defensive check to handle potential array or whitespace issues
    city = (Array.isArray(city) ? city[0] : city || '').trim();
    
    try {
        const query = `
            SELECT bi.*, h.name as hospital_name, h.city, h.contact 
            FROM blood_inventory bi 
            JOIN hospitals h ON bi.hospital_id = h.id 
            WHERE bi.blood_group = ? AND h.city LIKE ? AND bi.quantity > 0
        `;
        const [results] = await pool.execute(query, [blood_group, `%${city}%`]);
        const [hospitals] = await pool.execute('SELECT DISTINCT city FROM hospitals');
        
        res.render('common/search', { 
            user: req.session.user, 
            cities: hospitals, 
            searchResults: results,
            searchQuery: { blood_group, city }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Search Execution Error');
    }
};
