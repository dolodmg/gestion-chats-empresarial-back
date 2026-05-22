const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    // Obtener token del header
    const token = req.header('x-auth-token');

    // Verificar si no hay token
    if (!token) {
      return res.status(401).json({ msg: 'No token, autorización denegada' });
    }

    // Verificar token con un mejor manejo de errores
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded.user;
      next();
    } catch (err) {
      console.error('Error al verificar token:', err.message);
      
      // Verificar si el error es por expiración
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ msg: 'Token expirado, por favor inicie sesión nuevamente' });
      }
      
      // Otros errores de verificación
      return res.status(401).json({ msg: 'Token no válido' });
    }
  } catch (error) {
    console.error('Error general en middleware de autenticación:', error);
    res.status(500).json({ msg: 'Error del servidor en la autenticación' });
  }
};
