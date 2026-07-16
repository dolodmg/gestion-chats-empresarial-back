const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Advisor = require('../models/Advisor');
const {
  normalizeManualControlPreferences
} = require('../services/manualControlService');

async function getClientConfiguration(clientId) {
  if (!clientId) {
    return {};
  }

  const clientUser = await User.findOne({ clientId, role: 'client' })
    .select('featureFlags manualControlPreferences');

  return {
    featureFlags: clientUser?.featureFlags,
    manualControlPreferences: normalizeManualControlPreferences(
      clientUser?.manualControlPreferences
    )
  };
}

// Registro de usuario
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, clientId } = req.body;

    // Verificar si el usuario ya existe
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'El usuario ya existe' });
    }

    // Crear nuevo usuario
    user = new User({
      name,
      email,
      password,
      role,
      clientId: role === 'client' ? clientId : undefined,
    });

    await user.save();

    // Crear y enviar token JWT
    const payload = {
      user: {
        id: user.id,
        role: user.role,
        clientId: user.clientId,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      }
    );
  } catch (error) {
    console.error('Error in register:', error);
    res.status(500).json({ msg: 'Error del servidor' });
  }
};

// Login de usuario o asesor
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Primero buscar en User
    let user = await User.findOne({ email });
    let isAdvisor = false;
    let advisor = null;

    // Si no se encuentra en User, buscar en Advisor
    if (!user) {
      advisor = await Advisor.findOne({ email });
      if (!advisor) {
        return res.status(400).json({ msg: 'Credenciales inválidas' });
      }
      isAdvisor = true;
    }

    // Verificar contraseña
    const passwordToCompare = isAdvisor ? advisor.password : user.password;
    const isMatch = await bcrypt.compare(password, passwordToCompare);

    if (!isMatch) {
      return res.status(400).json({ msg: 'Credenciales inválidas' });
    }

    // Verificar si el asesor está activo
    if (isAdvisor && !advisor.active) {
      return res.status(403).json({ msg: 'Cuenta de asesor desactivada. Contacte al administrador.' });
    }

    // Crear payload según el tipo de usuario
    let payload, userResponse;

    if (isAdvisor) {
      const clientConfiguration = await getClientConfiguration(advisor.clientId);

      payload = {
        user: {
          id: advisor.id,
          role: 'advisor',
          clientId: advisor.clientId,
          advisorId: advisor.id
        },
      };

      userResponse = {
        id: advisor.id,
        name: advisor.name,
        email: advisor.email,
        role: 'advisor',
        clientId: advisor.clientId,
        advisorId: advisor.id,
        featureFlags: clientConfiguration.featureFlags,
        manualControlPreferences: clientConfiguration.manualControlPreferences
      };
    } else {
      payload = {
        user: {
          id: user.id,
          role: user.role,
          clientId: user.clientId,
        },
      };

      userResponse = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        clientId: user.clientId,
        featureFlags: user.featureFlags,
        allowPasswordChange: user.allowPasswordChange !== false,
        manualControlPreferences: normalizeManualControlPreferences(
          user.manualControlPreferences
        ),
      };
    }

    // Crear y enviar token JWT
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        res.json({
          token,
          user: userResponse
        });
      }
    );
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({ msg: 'Error del servidor' });
  }
};
