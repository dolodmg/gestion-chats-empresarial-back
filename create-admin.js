require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(async () => {
    console.log('MongoDB connected');
    
    try {
      // Verificar si ya existe un administrador
      const adminExists = await User.findOne({ role: 'admin' });
      
      if (adminExists) {
        console.log('Ya existe un usuario administrador');
        mongoose.disconnect();
        return;
      }
      
      // Crear administrador
      const admin = new User({
        name: 'Emi',
        email: 'emiliano@pushandpullnow.com',
        password: '07092015Leyla@',
        role: 'admin'
      });
      
      await admin.save();
      console.log('Usuario administrador creado con éxito');
      console.log('Email: admin@example.com');
      console.log('Contraseña: Admin123!');
      console.log('Por favor, cambie la contraseña después del primer inicio de sesión');
      
    } catch (error) {
      console.error('Error:', error);
    }
    
    mongoose.disconnect();
  })
  .catch((err) => console.error('Error de conexión:', err));
