const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');

// Obtener todos los usuarios (solo para administradores)
router.get('/', auth, async (req, res) => {
 try {
   if (req.user.role !== 'admin') {
     return res.status(403).json({ msg: 'Acceso denegado' });
   }
   
   const users = await User.find().select('-password');
   res.json(users);
 } catch (error) {
   console.error('Error fetching users:', error);
   res.status(500).json({ msg: 'Error del servidor' });
 }
});

// Crear un usuario (solo para administradores)
router.post('/', auth, async (req, res) => {
 try {
   if (req.user.role !== 'admin') {
     return res.status(403).json({ msg: 'Acceso denegado' });
   }
   
   const { name, email, password, role, clientId, workflowId, whatsappToken } = req.body;
   
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
      role: role || 'client',
      clientId: role === 'client' ? clientId : undefined,
      workflowId: (role === 'client' && workflowId) ? workflowId : undefined,
      whatsappToken: (role === 'client' && whatsappToken) ? whatsappToken : undefined
    });
   
   await user.save();
   
   res.json({ 
     msg: 'Usuario creado correctamente', 
     user: { 
       id: user.id, 
       name: user.name, 
       email: user.email, 
       role: user.role, 
       clientId: user.clientId, 
       workflowId: user.workflowId,
       hasWhatsappToken: !!user.whatsappToken
     } 
   });
 } catch (error) {
   console.error('Error creating user:', error);
   res.status(500).json({ msg: 'Error del servidor' });
 }
});

// Obtener un usuario específico (solo para administradores)
router.get('/:id', auth, async (req, res) => {
 try {
   if (req.user.role !== 'admin') {
     return res.status(403).json({ msg: 'Acceso denegado' });
   }
   
   const user = await User.findById(req.params.id).select('-password');
   if (!user) {
     return res.status(404).json({ msg: 'Usuario no encontrado' });
   }
   
   res.json(user);
 } catch (error) {
   console.error('Error fetching user:', error);
   res.status(500).json({ msg: 'Error del servidor' });
 }
});

// Actualizar un usuario (solo para administradores)
router.put('/:id', auth, async (req, res) => {
 try {
   if (req.user.role !== 'admin') {
     return res.status(403).json({ msg: 'Acceso denegado' });
   }
   
   const { name, email, password, role, clientId, workflowId, whatsappToken } = req.body;
   
   // Construir objeto de usuario
   const userFields = {};
   if (name) userFields.name = name;
   if (email) userFields.email = email;
   if (role) userFields.role = role;
   if (role === 'client' && clientId) userFields.clientId = clientId;
   if (role === 'client' && workflowId) userFields.workflowId = workflowId;
   
   // Agregar whatsappToken si se proporciona
   if (whatsappToken) userFields.whatsappToken = whatsappToken;
   
   // Si se proporcionó una nueva contraseña, cifrarla
   if (password) {
     const salt = await bcrypt.genSalt(10);
     userFields.password = await bcrypt.hash(password, salt);
   }
   
   // Verificar si el usuario existe
   let user = await User.findById(req.params.id);
   if (!user) {
     return res.status(404).json({ msg: 'Usuario no encontrado' });
   }
   
   // Actualizar usuario
   user = await User.findByIdAndUpdate(
     req.params.id,
     { $set: userFields },
     { new: true }
   ).select('-password');
   
   res.json(user);
 } catch (error) {
   console.error('Error updating user:', error);
   res.status(500).json({ msg: 'Error del servidor' });
 }
});

// Eliminar un usuario (solo para administradores)
router.delete('/:id', auth, async (req, res) => {
 try {
   if (req.user.role !== 'admin') {
     return res.status(403).json({ msg: 'Acceso denegado' });
   }
   
   // Verificar si el usuario existe
   const user = await User.findById(req.params.id);
   if (!user) {
     return res.status(404).json({ msg: 'Usuario no encontrado' });
   }
   
   // No permitir eliminar al propio usuario
   if (user._id.toString() === req.user.id) {
     return res.status(400).json({ msg: 'No puedes eliminar tu propia cuenta' });
   }
   
   // Eliminar usuario
   await User.findByIdAndDelete(req.params.id);
   
   res.json({ msg: 'Usuario eliminado correctamente' });
 } catch (error) {
   console.error('Error deleting user:', error);
   res.status(500).json({ msg: 'Error del servidor' });
 }
});

module.exports = router;