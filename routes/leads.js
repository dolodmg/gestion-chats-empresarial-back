/**
 * RUTAS API LEADS MULTI-CLIENTE
 * Archivo: routes/leads.js
 * 
 * Soporte para múltiples clientes: 676360675564956, 564098906790434, etc.
 * Usa autenticación N8N (mismo token que las otras APIs externas)
 */

const express = require('express');
const router = express.Router();
const leadsController = require('../controllers/leadsController');
const authenticateN8N = require('../middleware/authenticateN8N'); // Mismo token que otras APIs

// ==============================================
// RUTAS MULTI-CLIENTE CON AUTENTICACIÓN N8N
// ==============================================

/**
 * POST /api/leads/create
 * Crear lead individual con asignación automática de asesor
 * 
 * Headers requeridos:
 * - x-n8n-token: Token N8N (mismo que otras APIs)
 * 
 * CLIENT_ID se puede proporcionar de 4 formas:
 * 1. En el body: { "clientId": "676360675564956", ... }
 * 2. En query: ?clientId=676360675564956
 * 3. En header: x-client-id: 676360675564956
 * 
 * Body ejemplo:
 * {
 *   "clientId": "676360675564956",
 *   "servicio": "Ventas",
 *   "telefono": "1123456789", 
 *   "nombre": "Juan Pérez"
 * }
 */
router.post('/create', authenticateN8N, leadsController.createLead);

/**
 * POST /api/leads/bulk-create
 * Carga masiva de leads (máximo 100 por solicitud)
 * 
 * Headers requeridos:
 * - x-n8n-token: Token N8N
 * 
 * Body ejemplo:
 * {
 *   "clientId": "564098906790434",
 *   "leads": [
 *     {
 *       "servicio": "Ventas",
 *       "telefono": "1123456789",
 *       "nombre": "Juan Pérez"
 *     }
 *   ]
 * }
 */
router.post('/bulk-create', authenticateN8N, leadsController.bulkCreateLeads);

/**
 * GET /api/leads/advisor-stats
 * Obtener estadísticas de asignación de asesores
 * 
 * Headers requeridos:
 * - x-n8n-token: Token N8N
 * 
 * Query params:
 * - clientId: ID del cliente (requerido)
 * - servicio: Filtrar por servicio específico (opcional)
 * - days: Número de días hacia atrás (opcional, default: 7)
 * 
 * Ejemplo: /api/leads/advisor-stats?clientId=676360675564956&servicio=Ventas&days=30
 */
router.get('/advisor-stats', authenticateN8N, leadsController.getAdvisorStats);

/**
 * GET /api/leads/health
 * Health check del sistema de leads
 * 
 * Headers requeridos:
 * - x-n8n-token: Token N8N
 * 
 * Query params opcionales:
 * - clientId: Verificar tablas de cliente específico
 * 
 * Ejemplos:
 * /api/leads/health
 * /api/leads/health?clientId=676360675564956
 */
router.get('/health', authenticateN8N, leadsController.healthCheck);

/**
 * GET /api/leads/clients
 * Listar todos los clientes configurados
 * 
 * Headers requeridos:
 * - x-n8n-token: Token N8N
 * 
 * Respuesta incluye:
 * - Lista de clientes con tablas
 * - Cantidad de tablas por cliente
 * - Estado de configuración completa
 */
router.get('/clients', authenticateN8N, leadsController.listConfiguredClients);

module.exports = router;

module.exports = router;

module.exports = router;