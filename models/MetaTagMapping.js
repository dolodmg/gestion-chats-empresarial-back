const mongoose = require('mongoose');

const MetaTagMappingSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    tagName: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    eventName: {
        type: String,
        required: true,
        enum: [
            // Standard Meta Pixel Conversion Events
            'Purchase',           // Compra completada
            'Lead',              // Lead generado
            'Contact',           // Contacto
            'Schedule',          // Agendar cita
            'AddToCart',         // Agregar al carrito
            'ViewContent',       // Ver contenido
            'InitiateCheckout',  // Iniciar checkout
            'AddPaymentInfo',    // Agregar info de pago
            'CompleteRegistration', // Completar registro
            'Search',            // Búsqueda
            'AddToWishlist',     // Agregar a lista de deseos
            'Subscribe',         // Suscripción
            'StartTrial',        // Iniciar prueba
            'SubmitApplication', // Enviar aplicación
            'FindLocation',      // Encontrar ubicación
            'Donate',            // Donación
            'CustomizeProduct'   // Personalizar producto
        ],
        trim: true
    },
    defaultValue: {
        type: Number,
        default: null
    },
    defaultCurrency: {
        type: String,
        default: 'USD',
        trim: true,
        uppercase: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Compound index to ensure unique tag-event mapping per user
MetaTagMappingSchema.index({ userId: 1, tagName: 1 }, { unique: true });

module.exports = mongoose.model('MetaTagMapping', MetaTagMappingSchema);
