const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { getActivities } = require('../controllers/activityController');

router.use(authMiddleware);

router.get('/', getActivities);

module.exports = router;
