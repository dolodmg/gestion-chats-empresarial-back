const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Registro de usuario
router.post('/register', authController.register);

// Login de usuario
router.post('/login', authController.login);

// Obtener usuario autenticado
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ msg: 'Error del servidor' });
  }
});

// Cambiar contraseña de usuario
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
