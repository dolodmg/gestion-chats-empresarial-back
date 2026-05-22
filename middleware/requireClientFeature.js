const User = require('../models/User');

module.exports = function requireClientFeature(featureKey) {
  return async (req, res, next) => {
    try {
      if (req.user?.role === 'admin') {
        return next();
      }

      const clientId = req.user?.clientId;
      if (!clientId) {
        return res.status(400).json({ msg: 'Se requiere clientId' });
      }

      const clientUser = await User.findOne({ clientId, role: 'client' }).select('featureFlags');
      const isEnabled = clientUser?.featureFlags?.[featureKey];

      if (typeof isEnabled === 'boolean' && !isEnabled) {
        return res.status(403).json({ msg: 'Funcionalidad deshabilitada para este cliente' });
      }

      return next();
    } catch (error) {
      console.error(`Error validating feature flag "${featureKey}":`, error);
      return res.status(500).json({ msg: 'Error del servidor' });
    }
  };
};
