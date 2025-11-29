const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

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

// Login de usuario
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Verificar si el usuario existe
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'Credenciales inválidas' });
    }

    // Verificar contraseña
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Credenciales inválidas' });
    }

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
        res.json({ 
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            clientId: user.clientId,
          }
        });
      }
    );
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({ msg: 'Error del servidor' });
  }
};
