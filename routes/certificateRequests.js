const express = require('express');
const router = express.Router();

const certificateRequestController = require('../controllers/certificateRequestController');

router.post('/', certificateRequestController.createCertificateRequest);
router.get('/:jobId', certificateRequestController.getCertificateRequestStatus);

module.exports = router;
