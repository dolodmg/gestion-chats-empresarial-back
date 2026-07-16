const jwt = require('jsonwebtoken');

const BROWSER_TOKEN_PURPOSE = 'browser-resource';
const BROWSER_TOKEN_EXPIRY = process.env.BROWSER_TOKEN_EXPIRY || '12h';

function createBrowserToken(user) {
  return jwt.sign(
    {
      user: {
        id: user.id || user._id?.toString(),
        role: user.role,
        clientId: user.clientId,
        advisorId: user.advisorId
      },
      purpose: BROWSER_TOKEN_PURPOSE
    },
    process.env.JWT_SECRET,
    { expiresIn: BROWSER_TOKEN_EXPIRY }
  );
}

function verifyBrowserToken(token) {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  if (decoded.purpose !== BROWSER_TOKEN_PURPOSE || !decoded.user) {
    throw new Error('Invalid browser token purpose');
  }

  return decoded.user;
}

module.exports = {
  createBrowserToken,
  verifyBrowserToken
};
