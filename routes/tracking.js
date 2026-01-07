const express = require('express');
const router = express.Router();
const trackingController = require('../controllers/trackingController');

// Public routes (no authentication required)
router.get('/open/:campaignId/:recipientId', trackingController.trackEmailOpen);
router.get('/click/:campaignId/:recipientId', trackingController.trackLinkClick);

module.exports = router;
