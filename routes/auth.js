const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Advisor = require('../models/Advisor');
const bcrypt = require('bcryptjs');
const {
  normalizeManualControlPreferences,
  isValidWorkdayEndTime
} = require('../services/manualControlService');

// Registro de usuario
router.post('/register', authController.register);

// Login de usuario
router.post('/login', authController.login);

// Obtener usuario autenticado
router.get('/', auth, async (req, res) => {
  try {
    if (req.user.role === 'advisor') {
      const advisor = await Advisor.findById(req.user.id).select('-password');
      if (!advisor) {
        return res.status(404).json({ msg: 'Usuario no encontrado' });
      }

      const clientUser = await User.findOne({ clientId: advisor.clientId, role: 'client' })
        .select('featureFlags manualControlPreferences');

      return res.json({
        _id: advisor._id,
        id: advisor.id,
        name: advisor.name,
        email: advisor.email,
        role: 'advisor',
        clientId: advisor.clientId,
        advisorId: advisor.id,
        featureFlags: clientUser?.featureFlags,
        manualControlPreferences: normalizeManualControlPreferences(
          clientUser?.manualControlPreferences
        )
      });
    }

    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }

    const userResponse = user.toObject();
    userResponse.allowPasswordChange = user.allowPasswordChange !== false;
    userResponse.manualControlPreferences = normalizeManualControlPreferences(
      user.manualControlPreferences
    );
    res.json(userResponse);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ msg: 'Error del servidor' });
  }
});

// Cambiar contraseña de usuario
router.put('/manual-control-preferences', auth, async (req, res) => {
  try {
    if (req.user.role !== 'client') {
      return res.status(403).json({
        msg: 'Solo la cuenta principal puede modificar esta configuracion'
      });
    }

    const { durationSelectionEnabled, workdayEndTime } = req.body;

    if (typeof durationSelectionEnabled !== 'boolean') {
      return res.status(400).json({ msg: 'La habilitacion debe ser booleana' });
    }

    if (!isValidWorkdayEndTime(workdayEndTime)) {
      return res.status(400).json({ msg: 'La hora debe tener formato HH:mm' });
    }

    const user = await User.findOne({
      _id: req.user.id,
      role: 'client'
    });

    if (!user) {
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }

    user.manualControlPreferences = {
      durationSelectionEnabled,
      workdayEndTime,
      timeZone: 'America/Argentina/Buenos_Aires'
    };

    await user.save();

    res.json({
      manualControlPreferences: normalizeManualControlPreferences(
        user.manualControlPreferences
      )
    });
  } catch (error) {
    console.error('Error updating manual control preferences:', error);
    res.status(500).json({ msg: 'Error del servidor' });
  }
});

router.post('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    console.log('Cambio de contraseña solicitado para usuario ID:', req.user.id);

    // Verificar que se proporcionaron ambas contraseñas
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ msg: 'Por favor proporcione la contraseña actual y la nueva' });
    }

    // Obtener el usuario desde la base de datos
    const user = await User.findById(req.user.id);
    if (!user) {
      console.log('Usuario no encontrado:', req.user.id);
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }

    if (user.allowPasswordChange === false) {
      return res.status(403).json({ msg: 'El cambio de contraseña está deshabilitado para este usuario' });
    }

    // Verificar la contraseña actual
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      console.log('Contraseña actual incorrecta para usuario:', user.email);
      return res.status(401).json({ msg: 'Contraseña actual incorrecta' });
    }

    // Crear hash de la nueva contraseña
    console.log('Creando hash para nueva contraseña');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Actualizar directamente usando findByIdAndUpdate para asegurar la actualización
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { password: hashedPassword } },
      { new: true }
    ).select('-password');

    if (!updatedUser) {
      console.log('Error al actualizar el usuario');
      return res.status(500).json({ msg: 'Error al actualizar la contraseña' });
    }

    console.log('Contraseña actualizada correctamente para usuario:', user.email);
    res.json({ msg: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error('Error cambiando contraseña:', error);
    res.status(500).json({ msg: 'Error del servidor' });
  }
});

module.exports = router;
