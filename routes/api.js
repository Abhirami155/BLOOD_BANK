const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');

router.delete('/user/deleteAccount', apiController.deleteAccount);
router.post('/user/request-deactivation', apiController.requestDeactivation);
router.post('/user/request-reactivation', apiController.requestReactivation);
router.get('/hospitals/:id', apiController.getHospitalDetails);

module.exports = router;
