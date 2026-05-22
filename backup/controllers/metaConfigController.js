const MetaConfig = require('../models/MetaConfig');
const bcrypt = require('bcryptjs');
const metaService = require('../services/metaService');

/**
 * Get user's Meta configuration
 */
exports.getMetaConfig = async (req, res) => {
    try {
        const userId = req.user.id;

        const config = await MetaConfig.findOne({ userId });

        if (!config) {
            return res.json({
                configured: false,
                config: null
            });
        }

        // Return config with masked token for security
        res.json({
            configured: true,
            config: {
                metaDatasetId: config.metaDatasetId,
                metaAccessToken: '••••••••', // Masked for security
                metaTestEventCode: config.metaTestEventCode,
                createdAt: config.createdAt,
                updatedAt: config.updatedAt
            }
        });
    } catch (error) {
        console.error('Error getting Meta config:', error);
        res.status(500).json({ error: 'Error al obtener configuración de Meta' });
    }
};

/**
 * Save or update Meta configuration
 */
exports.saveMetaConfig = async (req, res) => {
    try {
        const userId = req.user.id;
        const { metaDatasetId, metaAccessToken, metaTestEventCode } = req.body;

        // Validate required fields
        if (!metaDatasetId || !metaAccessToken) {
            return res.status(400).json({
                error: 'Dataset ID y Access Token son requeridos'
            });
        }

        // Check if config exists
        let config = await MetaConfig.findOne({ userId });

        if (config) {
            // Update existing config
            config.metaDatasetId = metaDatasetId;
            config.metaAccessToken = metaAccessToken; // Will be encrypted by pre-save hook
            config.metaTestEventCode = metaTestEventCode || null;
            await config.save();
        } else {
            // Create new config
            config = new MetaConfig({
                userId,
                metaDatasetId,
                metaAccessToken, // Will be encrypted by pre-save hook
                metaTestEventCode: metaTestEventCode || null
            });
            await config.save();
        }

        res.json({
            message: 'Configuración de Meta guardada exitosamente',
            config: {
                metaDatasetId: config.metaDatasetId,
                metaAccessToken: '••••••••',
                metaTestEventCode: config.metaTestEventCode
            }
        });
    } catch (error) {
        console.error('Error saving Meta config:', error);
        res.status(500).json({ error: 'Error al guardar configuración de Meta' });
    }
};

/**
 * Delete Meta configuration
 */
exports.deleteMetaConfig = async (req, res) => {
    try {
        const userId = req.user.id;

        await MetaConfig.deleteOne({ userId });

        res.json({ message: 'Configuración de Meta eliminada exitosamente' });
    } catch (error) {
        console.error('Error deleting Meta config:', error);
        res.status(500).json({ error: 'Error al eliminar configuración de Meta' });
    }
};

/**
 * Test Meta API connection
 */
exports.testConnection = async (req, res) => {
    try {
        const userId = req.user.id;
        const { metaDatasetId, metaAccessToken, metaTestEventCode } = req.body;

        // Validate required fields
        if (!metaDatasetId || !metaAccessToken) {
            return res.status(400).json({
                error: 'Dataset ID y Access Token son requeridos para probar la conexión'
            });
        }

        // Send a test event
        const testEventData = {
            eventName: 'Purchase', // Using Purchase for test as it's universally accepted
            phoneNumber: '5491112345678', // Test phone number
            chatId: 'test_connection',
            value: 0,
            currency: 'USD'
        };

        const result = await metaService.sendConversionEvent(
            {
                metaDatasetId,
                metaAccessToken,
                metaTestEventCode
            },
            testEventData
        );

        res.json({
            success: true,
            message: 'Conexión exitosa con Meta CAPI',
            details: result
        });
    } catch (error) {
        console.error('Error testing Meta connection:', error);
        res.status(500).json({
            success: false,
            error: 'Error al probar conexión con Meta',
            details: error.error || error.message
        });
    }
};
