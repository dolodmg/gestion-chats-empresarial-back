// routes/sse.js

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const sseService = require('../services/sseService');

/**
 * Middleware para autenticar conexión SSE
 */
const authenticateSSE = (req, res, next) => {
  try {
    // El token puede venir en query params para SSE
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ msg: 'No token, autorización denegada' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // --- ⬇️ CORRECCIÓN 1 ⬇️ ---
    // Extraemos el objeto 'user' anidado del token,
    // ya que así es como se firma en tu authController.js
    req.user = decoded.user; 
    // --- ⬆️ FIN CORRECCIÓN 1 ⬆️ ---

    if (!req.user) {
      return res.status(401).json({ msg: 'Token inválido, payload de usuario no encontrado' });
    }

    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token inválido' });
  }
};

/**
 * Endpoint principal SSE
 * GET /api/sse/events?token=xxx
 */
router.get('/events', authenticateSSE, (req, res) => {
  
  // --- ⬇️ CORRECCIÓN 2 ⬇️ ---
  // Leemos 'id' (como está en el payload del token) 
  // y lo renombramos a 'userId' para usarlo en el servicio.
  const { id: userId, role, clientId } = req.user;
  // --- ⬆️ FIN CORRECCIÓN 2 ⬆️ ---

  console.log(`📡 Nueva conexión SSE de: ${userId} (${role})`);

  // Registrar cliente en el servicio SSE
  // Ahora se llamará con los valores correctos (ej: 'id_del_usuario', 'client', '751524394719240')
  sseService.addClient(userId, clientId, role, res);

  // La conexión queda abierta hasta que el cliente se desconecte
});

/**
 * Endpoint de estadísticas (solo para testing/debugging)
 */
router.get('/stats', authenticateSSE, (req, res) => {
  // (Esta ruta también se beneficia de la Corrección 1 en authenticateSSE)
  const stats = {
    totalConnections: sseService.getTotalConnections(),
    clients: sseService.getClientsInfo()
  };
  res.json(stats);
});

module.exports = router;