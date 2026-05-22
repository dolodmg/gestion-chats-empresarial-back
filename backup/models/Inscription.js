const mongoose = require('mongoose');

const InscriptionSchema = new mongoose.Schema({
  dni: {
    type: String,
    required: true,
    index: true,
  },
  nombreCompleto: {
    type: String,
    required: true,
  },
  curso: {
    type: String,
    required: true,
  },
  correo: {
    type: String,
    required: true,
  },
  provincia: {
    type: String,
    required: true,
    index: true,
    // QUITAR el enum para permitir cualquier valor
    // El controlador se encarga de la validación lógica
  },
  localidad: {
    type: String,
    required: true,
  },
  codigoPostal: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  }
});

InscriptionSchema.index({ dni: 1 });
InscriptionSchema.index({ provincia: 1 });
InscriptionSchema.index({ createdAt: -1 });

InscriptionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Inscription', InscriptionSchema);