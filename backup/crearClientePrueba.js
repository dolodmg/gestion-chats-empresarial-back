// Script para crear un usuario cliente de prueba (create-test-client.js)
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
      // Crear un usuario cliente para una prueba específica
      const testClient = new User({
        name: "Cliente Prueba",
        email: "cliente.prueba@ejemplo.com",
        password: "ClientePrueba123!",
        role: "client",
        clientId: "577642088768581" // Usa el phone_number_id real de un bot
      });
      
      await testClient.save();
      console.log('Usuario cliente creado con éxito');
      console.log('Email: cliente.prueba@ejemplo.com');
      console.log('Contraseña: ClientePrueba123!');
      console.log('ClientId (phone_number_id): 577642088768581');
      
    } catch (error) {
      console.error('Error:', error);
    }
    
    mongoose.disconnect();
  })
  .catch((err) => console.error('Error de conexión:', err));
