const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const emailCredentialController = require('../controllers/emailCredentialController');

// All routes require authentication
router.use(auth);

// CRUD operations
router.post('/', emailCredentialController.createCredential);
router.get('/', emailCredentialController.getCredentials);
router.get('/:id', emailCredentialController.getCredentialById);
router.put('/:id', emailCredentialController.updateCredential);
router.delete('/:id', emailCredentialController.deleteCredential);

// Test connection
router.post('/test', emailCredentialController.testCredential);
router.post('/:id/test', emailCredentialController.testCredential);

module.exports = router;
