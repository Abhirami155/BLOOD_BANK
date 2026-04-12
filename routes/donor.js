const express = require('express');
const router = express.Router();
const donorController = require('../controllers/donorController');
const { isDonor } = require('../middlewares/auth');

router.get('/dashboard', isDonor, donorController.getDashboard);
router.get('/history', isDonor, donorController.getHistory);
router.post('/update', isDonor, donorController.updateProfile);

module.exports = router;
