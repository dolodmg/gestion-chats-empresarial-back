const jwt = require('jsonwebtoken');
const { verifyBrowserToken } = require('../utils/browserToken');

module.exports = (req, res, next) => {
  try {
    const browserToken = req.query.browserToken || req.header('x-browser-token');
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : null;
    const authToken = req.header('x-auth-token');
    const token = bearerToken || authToken;

    if (browserToken) {
      req.user = verifyBrowserToken(browserToken);
      return next();
    }

    if (!token) {
      return res.status(401).json({ msg: 'No token, autorizacion denegada' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;

    if (!req.user) {
      return res.status(401).json({ msg: 'Token no valido' });
    }

    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ msg: 'Token expirado' });
    }

    return res.status(401).json({ msg: 'Token no valido' });
  }
};
