const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Message = require('../models/Message');
const { serializeUser } = require('../utils/userResponse');
const { logAction } = require('../services/auditService');
const ARGENTINA_UTC_OFFSET = '-03:00';
const FEATURE_FLAG_KEYS = [
  'data',
  'campaigns',
  'whatsappCampaigns',
  'templates',
  'advisors',
  'advisorMetrics',
  'inscripciones',
  'metaEventos',
  'assistant',
  'conversationSummary',
  'sendTemplates',
];

function ensureAdmin(req, res) {
  if (req.user.role !== 'admin') {
    res.status(403).json({ msg: 'Acceso denegado' });
    return false;
  }

  return true;
}

function parseDateRange(startDate, endDate) {
  const timestampFilter = {};

  if (startDate) {
    const parsedStartDate = new Date(`${startDate}T00:00:00.000${ARGENTINA_UTC_OFFSET}`);
    if (Number.isNaN(parsedStartDate.getTime())) {
      return { error: 'startDate invalida. Usa formato YYYY-MM-DD' };
    }
    timestampFilter.$gte = parsedStartDate;
  }

  if (endDate) {
    const parsedEndDate = new Date(`${endDate}T23:59:59.999${ARGENTINA_UTC_OFFSET}`);
    if (Number.isNaN(parsedEndDate.getTime())) {
      return { error: 'endDate invalida. Usa formato YYYY-MM-DD' };
    }
    timestampFilter.$lte = parsedEndDate;
  }

  if (timestampFilter.$gte && timestampFilter.$lte && timestampFilter.$gte > timestampFilter.$lte) {
    return { error: 'startDate no puede ser mayor que endDate' };
  }

  return { timestampFilter };
}

function buildTimestampNormalizationStage() {
  return {
    $addFields: {
      normalizedTimestamp: {
        $convert: {
          input: '$timestamp',
          to: 'date',
          onError: null,
          onNull: null
        }
      }
    }
  };
}

function buildDateRangeMatch(timestampFilter) {
  if (!Object.keys(timestampFilter).length) {
    return null;
  }

  return {
    normalizedTimestamp: timestampFilter
  };
}

exports.getUsers = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const users = await User.find().select('-password');
    res.json(users.map(serializeUser));
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ msg: 'Error del servidor' });
  }
};

exports.createUser = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { name, email, password, role, clientId, workflowId, whatsappToken, wabaId, featureFlags, allowPasswordChange } = req.body;

    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'El usuario ya existe' });
    }

    user = new User({
      name,
      email,
      password,
      role: role || 'client',
      clientId: role === 'client' ? clientId : undefined,
      workflowId: role === 'client' && workflowId ? workflowId : undefined,
      whatsappToken: role === 'client' && whatsappToken ? whatsappToken : undefined,
      wabaId: role === 'client' && wabaId ? wabaId : undefined,
      featureFlags: role === 'client' && featureFlags ? featureFlags : undefined,
      allowPasswordChange: typeof allowPasswordChange === 'boolean' ? allowPasswordChange : true
    });

    await user.save();

    void logAction({
      req,
      clientId: user.clientId || null,
      action: 'user.created',
      targetType: 'user',
      targetId: user.id,
      metadata: {
        role: user.role,
        email: user.email,
        workflowId: user.workflowId || null,
        hasWhatsappToken: Boolean(user.whatsappToken),
        wabaId: user.wabaId || null
      }
    });

    res.json({
      msg: 'Usuario creado correctamente',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        clientId: user.clientId,
        workflowId: user.workflowId,
        hasWhatsappToken: !!user.whatsappToken,
        featureFlags: user.featureFlags,
        allowPasswordChange: user.allowPasswordChange !== false
      }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ msg: 'Error del servidor' });
  }
};

exports.getClientMetrics = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { clientId, startDate, endDate } = req.query;
    const { timestampFilter, error } = parseDateRange(startDate, endDate);

    if (error) {
      return res.status(400).json({ msg: error });
    }

    if (!clientId) {
      return res.status(400).json({ msg: 'Se requiere clientId' });
    }

    const baseMatch = { clientId };
    const dateRangeMatch = buildDateRangeMatch(timestampFilter);

    const [messageStats, activeChatsCount] = await Promise.all([
      Message.aggregate([
        { $match: baseMatch },
        buildTimestampNormalizationStage(),
        ...(dateRangeMatch ? [{ $match: dateRangeMatch }] : []),
        {
          $group: {
            _id: null,
            incomingMessages: {
              $sum: {
                $cond: [{ $eq: ['$sender', 'user'] }, 1, 0]
              }
            },
            botMessages: {
              $sum: {
                $cond: [{ $eq: ['$sender', 'bot'] }, 1, 0]
              }
            },
            totalMessages: { $sum: 1 },
            lastMessageAt: { $max: '$normalizedTimestamp' }
          }
        }
      ]),
      Message.aggregate([
        { $match: { ...baseMatch, chatId: { $nin: [null, ''] } } },
        buildTimestampNormalizationStage(),
        ...(dateRangeMatch ? [{ $match: dateRangeMatch }] : []),
        {
          $group: {
            _id: '$chatId'
          }
        },
        {
          $count: 'total'
        }
      ]).then((result) => result[0]?.total || 0)
    ]);

    const totals = messageStats[0] || {
      incomingMessages: 0,
      botMessages: 0,
      totalMessages: 0,
      lastMessageAt: null
    };

    res.json({
      clientId,
      incomingMessages: totals.incomingMessages || 0,
      botMessages: totals.botMessages || 0,
      totalMessages: totals.totalMessages || 0,
      activeChatsInRange: activeChatsCount,
      lastMessageAt: totals.lastMessageAt || null,
      dateRange: {
        startDate: startDate || null,
        endDate: endDate || null
      }
    });
  } catch (error) {
    console.error('Error fetching client metrics:', error);
    res.status(500).json({ msg: 'Error del servidor' });
  }
};

exports.getUserById = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }

    res.json(serializeUser(user));
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ msg: 'Error del servidor' });
  }
};

exports.updateUser = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { name, email, password, role, clientId, workflowId, whatsappToken, wabaId, featureFlags, allowPasswordChange } = req.body;

    console.log('[users.update] request received', {
      userId: req.params.id,
      actorId: req.user?.id,
      actorRole: req.user?.role,
      featureFlags
    });

    let user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }

    console.log('[users.update] current stored featureFlags', {
      userId: user._id?.toString(),
      currentFeatureFlags: user.featureFlags
    });

    const userFields = {};
    if (typeof name !== 'undefined') userFields.name = name;
    if (typeof email !== 'undefined') userFields.email = email;
    if (typeof role !== 'undefined') userFields.role = role;

    const targetRole = role || user.role;

    if (targetRole === 'client' && typeof clientId !== 'undefined') userFields.clientId = clientId;
    if (targetRole === 'client' && typeof workflowId !== 'undefined') userFields.workflowId = workflowId;
    if (typeof whatsappToken !== 'undefined') userFields.whatsappToken = whatsappToken;
    if (typeof wabaId !== 'undefined') userFields.wabaId = wabaId;
    if (typeof allowPasswordChange === 'boolean') userFields.allowPasswordChange = allowPasswordChange;

    if (featureFlags && typeof featureFlags === 'object') {
      userFields.featureFlags = {
        ...(user.featureFlags?.toObject ? user.featureFlags.toObject() : user.featureFlags || {})
      };

      FEATURE_FLAG_KEYS.forEach((key) => {
        if (typeof featureFlags[key] === 'boolean') {
          userFields.featureFlags[key] = featureFlags[key];
        }
      });

      console.log('[users.update] merged featureFlags to save', {
        userId: user._id?.toString(),
        mergedFeatureFlags: userFields.featureFlags
      });
    }

    if (password) {
      const salt = await bcrypt.genSalt(10);
      userFields.password = await bcrypt.hash(password, salt);
    }

    user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: userFields },
      { new: true }
    ).select('-password');

    console.log('[users.update] persisted user', {
      userId: user?._id?.toString(),
      persistedFeatureFlags: user?.featureFlags
    });

    void logAction({
      req,
      clientId: user.clientId || null,
      action: 'user.updated',
      targetType: 'user',
      targetId: user.id,
      metadata: {
        updatedFields: Object.keys(userFields),
        role: user.role,
        email: user.email,
        workflowId: user.workflowId || null,
        hasWhatsappToken: Boolean(user.whatsappToken),
        wabaId: user.wabaId || null
      }
    });

    res.json(serializeUser(user));
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ msg: 'Error del servidor' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }

    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ msg: 'No puedes eliminar tu propia cuenta' });
    }

    await User.findByIdAndDelete(req.params.id);

    void logAction({
      req,
      clientId: user.clientId || null,
      action: 'user.deleted',
      targetType: 'user',
      targetId: user.id,
      metadata: {
        role: user.role,
        email: user.email
      }
    });

    res.json({ msg: 'Usuario eliminado correctamente' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ msg: 'Error del servidor' });
  }
};
