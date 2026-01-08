const express = require('express');
const router = express.Router();
const advisorMetricsController = require('../controllers/advisorMetricsController');
const auth = require('../middleware/auth');

// @route   GET /api/advisor-metrics
// @desc    Get metrics for all advisors
// @access  Private (admin, client)
router.get('/', auth, advisorMetricsController.getAdvisorMetrics);

module.exports = router;
