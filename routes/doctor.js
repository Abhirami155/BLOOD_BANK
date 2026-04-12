const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const { isDoctor } = require('../middlewares/auth');

router.get('/dashboard', isDoctor, doctorController.getDashboard);
router.get('/patients', isDoctor, doctorController.getPatients);
router.post('/request', isDoctor, doctorController.createRequest);

module.exports = router;
