const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAdmin } = require('../middlewares/auth');

router.get('/dashboard', isAdmin, adminController.getDashboard);
router.get('/hospitals', isAdmin, adminController.getHospitals);
router.get('/hospital', isAdmin, adminController.getHospitals); // Alias
router.get('/doctors', isAdmin, adminController.getDoctors);
router.get('/doctor', isAdmin, adminController.getDoctors); // Alias
router.get('/donors', isAdmin, adminController.getDonors);
router.get('/donor', isAdmin, adminController.getDonors); // Alias
router.get('/stock', isAdmin, adminController.getStock);
router.post('/donor/approve/:id', isAdmin, adminController.approveDonor);
router.post('/donor/reject/:id', isAdmin, adminController.rejectDonor);
router.get('/patients', isAdmin, adminController.getPatients);
router.post('/toggle-status', isAdmin, adminController.toggleStatus);
router.post('/delete-user', isAdmin, adminController.deleteUser);
router.post('/handle-deactivation-request', isAdmin, adminController.handleDeactivationRequest);
router.post('/handle-reactivation-request', isAdmin, adminController.handleReactivationRequest);
router.get('/details/:role/:targetId', isAdmin, adminController.getDetails);
router.get('/donations', isAdmin, adminController.getDonations);

module.exports = router;
