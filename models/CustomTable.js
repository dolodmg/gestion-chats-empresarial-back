const mongoose = require('mongoose');

// Esquema para definir los campos de una tabla personalizada
const FieldSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['string', 'number', 'date', 'boolean', 'email', 'phone', 'textarea', 'select']
  },
  required: {
    type: Boolean,
    default: false
  },
  label: {
    type: String,
    required: true
  },
  placeholder: {
    type: String,
    default: ''
  },
  options: {
    type: [String], // Para campos tipo 'select'
    default: []
  },
  validation: {
    minLength: Number,
    maxLength: Number,
    min: Number,
    max: Number
  }
});

// Esquema principal para las tablas personalizadas
const CustomTableSchema = new mongoose.Schema({
  clientId: {
    type: String,
    required: true,
    index: true
  },
  tableName: {
    type: String,
    required: true,
    trim: true
  },
  collectionName: {
    type: String,
    required: true,
    unique: true, // Validación única a nivel de BD
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  fields: [FieldSchema],
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Índice compuesto para búsquedas eficientes
CustomTableSchema.index({ clientId: 1, tableName: 1 });

// Middleware para actualizar updatedAt
CustomTableSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Validación personalizada para nombres de colección
CustomTableSchema.pre('save', function(next) {
  // Validar formato del nombre de colección
  const collectionNameRegex = /^[a-zA-Z][a-zA-Z0-9_]*$/;
  if (!collectionNameRegex.test(this.collectionName)) {
    const error = new Error('El nombre de la colección debe empezar con una letra y solo contener letras, números y guiones bajos');
    return next(error);
  }
  
  // Evitar nombres reservados
  const reservedNames = [
    'users', 'chats', 'messages', 'chatstates', 'assistantprompts', 
    'inscriptions', 'customtables', 'admin', 'system'
  ];
  
  if (reservedNames.includes(this.collectionName.toLowerCase())) {
    const error = new Error('El nombre de colección está reservado. Por favor, elige otro nombre');
    return next(error);
  }
  
  next();
});

// Métodos estáticos
CustomTableSchema.statics.findByClient = function(clientId) {
  return this.find({ clientId, isActive: true }).sort({ createdAt: -1 });
};

CustomTableSchema.statics.checkCollectionExists = async function(collectionName) {
  const existing = await this.findOne({ collectionName });
  return !!existing;
};

// Método para obtener esquema de validación para los datos
CustomTableSchema.methods.getValidationSchema = function() {
  const schema = {};
  
  this.fields.forEach(field => {
    let fieldSchema = {};
    
    switch (field.type) {
      case 'string':
      case 'email':
      case 'phone':
      case 'textarea':
        fieldSchema.type = String;
        if (field.validation && field.validation.minLength) {
          fieldSchema.minlength = field.validation.minLength;
        }
        if (field.validation && field.validation.maxLength) {
          fieldSchema.maxlength = field.validation.maxLength;
        }
        break;
      case 'number':
        fieldSchema.type = Number;
        if (field.validation && field.validation.min !== undefined) {
          fieldSchema.min = field.validation.min;
        }
        if (field.validation && field.validation.max !== undefined) {
          fieldSchema.max = field.validation.max;
        }
        break;
      case 'date':
        fieldSchema.type = Date;
        break;
      case 'boolean':
        fieldSchema.type = Boolean;
        break;
      case 'select':
        fieldSchema.type = String;
        if (field.options && field.options.length > 0) {
          fieldSchema.enum = field.options;
        }
        break;
    }
    
    if (field.required) {
      fieldSchema.required = true;
    }
    
    schema[field.name] = fieldSchema;
  });
  
  // Agregar campos de auditoría automáticamente
  schema.createdAt = { type: Date, default: Date.now };
  schema.updatedAt = { type: Date, default: Date.now };
  
  return schema;
};

module.exports = mongoose.model('CustomTable', CustomTableSchema);