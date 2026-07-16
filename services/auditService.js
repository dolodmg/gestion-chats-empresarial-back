const AuditLog = require('../models/AuditLog');

function getIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];

  if (Array.isArray(forwardedFor)) {
    return forwardedFor[0] || req.ip || null;
  }

  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || null;
}

function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }

  const clone = { ...metadata };

  delete clone.password;
  delete clone.currentPassword;
  delete clone.newPassword;
  delete clone.whatsappToken;
  delete clone.token;
  delete clone.browserToken;

  return clone;
}

async function logAction({
  req,
  actor,
  clientId = null,
  action,
  targetType = null,
  targetId = null,
  metadata = {}
}) {
  try {
    const resolvedActor = actor || req?.user || null;

    await AuditLog.create({
      actorId: resolvedActor?.id || resolvedActor?._id?.toString() || null,
      actorRole: resolvedActor?.role || 'anonymous',
      actorEmail: resolvedActor?.email || null,
      clientId: clientId || resolvedActor?.clientId || null,
      action,
      targetType,
      targetId: targetId != null ? String(targetId) : null,
      metadata: sanitizeMetadata(metadata),
      ip: req ? getIp(req) : null,
      userAgent: req?.headers?.['user-agent'] || null
    });
  } catch (error) {
    console.error('Audit log error:', error.message);
  }
}

module.exports = {
  logAction
};
