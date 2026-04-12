const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');
const { isPatient } = require('../middlewares/auth');

router.get('/dashboard', isPatient, patientController.getDashboard);
router.get('/requests', isPatient, patientController.getRequests);
router.post('/search', isPatient, patientController.searchBlood);
router.post('/request', isPatient, patientController.createRequest);

module.exports = router;
