const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const sendingDomainController = require('../controllers/sendingDomainController');

router.use(auth);

router.post('/', sendingDomainController.createSendingDomain);
router.get('/', sendingDomainController.getSendingDomains);
router.get('/:id', sendingDomainController.getSendingDomainById);
router.post('/:id/verify', sendingDomainController.verifySendingDomain);
router.delete('/:id', sendingDomainController.deleteSendingDomain);

module.exports = router;
