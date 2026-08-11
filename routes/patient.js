const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');
const { isPatient } = require('../middlewares/auth');

router.get('/dashboard', isPatient, patientController.getDashboard);
router.get('/requests', isPatient, patientController.getRequests);
router.post('/search', isPatient, patientController.searchBlood);
// POST /patient/request is intentionally REMOVED — patients cannot raise blood requests.
// Only doctors can raise requests on behalf of their patients.

module.exports = router;
