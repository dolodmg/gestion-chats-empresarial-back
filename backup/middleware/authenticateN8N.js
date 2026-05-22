/**
 * Middleware de autenticación para n8n
 * Verifica que las llamadas vengan de n8n usando un token secreto
 */

// Middleware para verificar token de n8n
const authenticateN8N = (req, res, next) => {
  try {
    // Obtener token del header
    const token = req.header('x-n8n-token') || req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      console.log('❌ Token faltante en llamada a API');
      return res.status(401).json({ 
        success: false, 
        error: 'Token de autenticación requerido' 
      });
    }

    // Verificar token contra el configurado en .env
    const validToken = process.env.N8N_API_TOKEN;
    
    if (!validToken) {
      console.error('❌ N8N_API_TOKEN no configurado en .env');
      return res.status(500).json({ 
        success: false, 
        error: 'Token de servidor no configurado' 
      });
    }

    if (token !== validToken) {
      console.log('❌ Token inválido en llamada a API');
      return res.status(401).json({ 
        success: false, 
        error: 'Token inválido' 
      });
    }

    console.log('✅ Token n8n válido');
    next();

  } catch (error) {
    console.error('❌ Error verificando token n8n:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno de autenticación' 
    });
  }
};

module.exports = authenticateN8N;