const express = require('express');
const router = express.Router();
const hospitalController = require('../controllers/hospitalController');
const { isHospital } = require('../middlewares/auth');

router.get('/dashboard', isHospital, hospitalController.getDashboard);
router.get('/patients', isHospital, hospitalController.getPatients);
router.get('/search-donors', isHospital, hospitalController.getSearchDonors);
router.get('/inventory', isHospital, hospitalController.getInventory);
router.post('/patients/add', isHospital, hospitalController.addPatient);
router.post('/inventory', isHospital, hospitalController.updateInventory);
router.post('/donation', isHospital, hospitalController.addDonation);
router.post('/request/:requestId/:action', isHospital, hospitalController.handleRequest);

module.exports = router;
