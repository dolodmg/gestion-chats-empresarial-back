const express = require('express');
const router = express.Router();
const sseService = require('../services/sseService');
const authenticateBrowserResource = require('../middleware/authenticateBrowserResource');

router.get('/events', authenticateBrowserResource, (req, res) => {
  const { id: userId, role, clientId } = req.user;

  console.log(`Nueva conexion SSE de: ${userId} (${role})`);
  sseService.addClient(userId, clientId, role, res);
});

router.get('/stats', authenticateBrowserResource, (req, res) => {
  const stats = {
    totalConnections: sseService.getTotalConnections(),
    clients: sseService.getClientsInfo()
  };

  res.json(stats);
});

module.exports = router;
