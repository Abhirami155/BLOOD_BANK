const express = require('express');
const router = express.Router();
const commonController = require('../controllers/commonController');
const { isAuthenticated } = require('../middlewares/auth');

router.get('/stock', isAuthenticated, commonController.getGlobalStock);
router.get('/search', isAuthenticated, commonController.getSearch);
router.post('/search', isAuthenticated, commonController.postSearch);

module.exports = router;
