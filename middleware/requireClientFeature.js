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

      console.log('[requireClientFeature] check', {
        featureKey,
        actorId: req.user?.id,
        actorRole: req.user?.role,
        clientId,
        clientUserId: clientUser?._id?.toString?.(),
        featureFlags: clientUser?.featureFlags,
        resolvedValue: isEnabled
      });

      if (typeof isEnabled === 'boolean' && !isEnabled) {
        console.log('[requireClientFeature] denied', {
          featureKey,
          clientId,
          resolvedValue: isEnabled
        });
        return res.status(403).json({ msg: 'Funcionalidad deshabilitada para este cliente' });
      }

      console.log('[requireClientFeature] allowed', {
        featureKey,
        clientId,
        resolvedValue: isEnabled
      });
      return next();
    } catch (error) {
      console.error(`Error validating feature flag "${featureKey}":`, error);
      return res.status(500).json({ msg: 'Error del servidor' });
    }
  };
};
