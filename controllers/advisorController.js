const Advisor = require('../models/Advisor');
const AdvisorConfig = require('../models/AdvisorConfig');
const AdvisorTableAssignment = require('../models/AdvisorTableAssignment');
const advisorService = require('../services/advisorService');

/**
 * GET /api/advisors/config
 * Obtener configuración del módulo de asesores
 */
exports.getConfig = async (req, res) => {
    try {
        const clientId = req.user.clientId;
        const config = await advisorService.getOrCreateConfig(clientId);

        res.json({
            success: true,
            data: config
        });
    } catch (error) {
        console.error('Error obteniendo configuración:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener configuración'
        });
    }
};

/**
 * PUT /api/advisors/config
 * Actualizar configuración (habilitar/deshabilitar módulo)
 */
exports.updateConfig = async (req, res) => {
    try {
        const clientId = req.user.clientId;
        const { enabled } = req.body;

        if (typeof enabled !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'El campo enabled debe ser un booleano'
            });
        }

        let config = await AdvisorConfig.findOne({ clientId });

        if (!config) {
            config = new AdvisorConfig({ clientId, enabled });
        } else {
            config.enabled = enabled;
        }

        await config.save();

        res.json({
            success: true,
            message: `Módulo ${enabled ? 'habilitado' : 'deshabilitado'} correctamente`,
            data: config
        });
    } catch (error) {
        console.error('Error actualizando configuración:', error);
        res.status(500).json({
            success: false,
            error: 'Error al actualizar configuración'
        });
    }
};

/**
 * GET /api/advisors
 * Listar todos los asesores del cliente
 */
exports.getAdvisors = async (req, res) => {
    try {
        const clientId = req.user.clientId;

        const advisors = await Advisor.find({ clientId }).sort({ createdAt: -1 });

        res.json({
            success: true,
            data: advisors
        });
    } catch (error) {
        console.error('Error obteniendo asesores:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener asesores'
        });
    }
};

/**
 * POST /api/advisors
 * Crear un nuevo asesor
 */
exports.createAdvisor = async (req, res) => {
    try {
        const clientId = req.user.clientId;
        const { name, email, phone } = req.body;

        if (!name || name.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'El nombre es requerido'
            });
        }

        if (!email || email.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'El email es requerido'
            });
        }

        // Verificar que el email no esté en uso
        const existingAdvisor = await Advisor.findOne({ email: email.trim().toLowerCase() });
        if (existingAdvisor) {
            return res.status(400).json({
                success: false,
                error: 'El email ya está en uso'
            });
        }

        // Generar contraseña aleatoria
        const generatedPassword = generateRandomPassword(12);

        const advisor = new Advisor({
            clientId,
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password: generatedPassword, // Se hasheará automáticamente por el middleware pre-save
            phone: phone || '',
            active: true
        });

        await advisor.save();

        // Retornar el asesor con la contraseña generada (solo esta vez)
        res.status(201).json({
            success: true,
            message: 'Asesor creado correctamente',
            data: {
                _id: advisor._id,
                clientId: advisor.clientId,
                name: advisor.name,
                email: advisor.email,
                phone: advisor.phone,
                active: advisor.active,
                createdAt: advisor.createdAt,
                generatedPassword: generatedPassword // IMPORTANTE: Solo se muestra al crear
            }
        });
    } catch (error) {
        console.error('Error creando asesor:', error);
        res.status(500).json({
            success: false,
            error: 'Error al crear asesor'
        });
    }
};

/**
 * Genera una contraseña aleatoria segura
 */
function generateRandomPassword(length = 12) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';

    // Asegurar al menos un carácter de cada tipo
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // Mayúscula
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // Minúscula
    password += '0123456789'[Math.floor(Math.random() * 10)]; // Número
    password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // Especial

    // Completar el resto
    for (let i = password.length; i < length; i++) {
        password += charset[Math.floor(Math.random() * charset.length)];
    }

    // Mezclar los caracteres
    return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * PUT /api/advisors/:id
 * Actualizar un asesor
 */
exports.updateAdvisor = async (req, res) => {
    try {
        const clientId = req.user.clientId;
        const { id } = req.params;
        const { name, email, phone, active } = req.body;

        const advisor = await Advisor.findOne({ _id: id, clientId });

        if (!advisor) {
            return res.status(404).json({
                success: false,
                error: 'Asesor no encontrado'
            });
        }

        if (name !== undefined) advisor.name = name.trim();
        if (email !== undefined) advisor.email = email;
        if (phone !== undefined) advisor.phone = phone;
        if (active !== undefined) advisor.active = active;

        await advisor.save();

        res.json({
            success: true,
            message: 'Asesor actualizado correctamente',
            data: advisor
        });
    } catch (error) {
        console.error('Error actualizando asesor:', error);
        res.status(500).json({
            success: false,
            error: 'Error al actualizar asesor'
        });
    }
};

/**
 * DELETE /api/advisors/:id
 * Eliminar un asesor
 */
exports.deleteAdvisor = async (req, res) => {
    try {
        const clientId = req.user.clientId;
        const { id } = req.params;

        const advisor = await Advisor.findOne({ _id: id, clientId });

        if (!advisor) {
            return res.status(404).json({
                success: false,
                error: 'Asesor no encontrado'
            });
        }

        // Eliminar todas las asignaciones de este asesor
        await AdvisorTableAssignment.deleteMany({ advisorId: id });

        // Eliminar el asesor
        await Advisor.deleteOne({ _id: id });

        res.json({
            success: true,
            message: 'Asesor eliminado correctamente'
        });
    } catch (error) {
        console.error('Error eliminando asesor:', error);
        res.status(500).json({
            success: false,
            error: 'Error al eliminar asesor'
        });
    }
};

/**
 * GET /api/advisors/assignments/:tableId
 * Obtener asesores asignados a una tabla específica
 */
exports.getTableAssignments = async (req, res) => {
    try {
        const clientId = req.user.clientId;
        const { tableId } = req.params;

        const assignments = await AdvisorTableAssignment.find({
            clientId,
            tableId
        })
            .populate('advisorId')
            .sort({ position: 1 });

        res.json({
            success: true,
            data: assignments
        });
    } catch (error) {
        console.error('Error obteniendo asignaciones:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener asignaciones'
        });
    }
};

/**
 * POST /api/advisors/assignments
 * Asignar un asesor a una tabla
 */
exports.assignToTable = async (req, res) => {
    try {
        const clientId = req.user.clientId;
        const { advisorId, tableId } = req.body;

        if (!advisorId || !tableId) {
            return res.status(400).json({
                success: false,
                error: 'advisorId y tableId son requeridos'
            });
        }

        // Verificar que el asesor pertenece al cliente
        const advisor = await Advisor.findOne({ _id: advisorId, clientId });
        if (!advisor) {
            return res.status(404).json({
                success: false,
                error: 'Asesor no encontrado'
            });
        }

        // Verificar si ya existe la asignación
        const existing = await AdvisorTableAssignment.findOne({
            clientId,
            advisorId,
            tableId
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                error: 'Este asesor ya está asignado a esta tabla'
            });
        }

        // Obtener la siguiente posición
        const count = await AdvisorTableAssignment.countDocuments({ clientId, tableId });

        const assignment = new AdvisorTableAssignment({
            clientId,
            advisorId,
            tableId,
            position: count
        });

        await assignment.save();

        // Poblar el asesor para la respuesta
        await assignment.populate('advisorId');

        res.status(201).json({
            success: true,
            message: 'Asesor asignado a la tabla correctamente',
            data: assignment
        });
    } catch (error) {
        console.error('Error asignando asesor a tabla:', error);
        res.status(500).json({
            success: false,
            error: 'Error al asignar asesor a tabla'
        });
    }
};

/**
 * DELETE /api/advisors/assignments/:id
 * Quitar un asesor de una tabla
 */
exports.removeFromTable = async (req, res) => {
    try {
        const clientId = req.user.clientId;
        const { id } = req.params;

        const assignment = await AdvisorTableAssignment.findOne({ _id: id, clientId });

        if (!assignment) {
            return res.status(404).json({
                success: false,
                error: 'Asignación no encontrada'
            });
        }

        const tableId = assignment.tableId;
        const position = assignment.position;

        // Eliminar la asignación
        await AdvisorTableAssignment.deleteOne({ _id: id });

        // Reordenar las posiciones de los asesores restantes
        await AdvisorTableAssignment.updateMany(
            { clientId, tableId, position: { $gt: position } },
            { $inc: { position: -1 } }
        );

        res.json({
            success: true,
            message: 'Asesor removido de la tabla correctamente'
        });
    } catch (error) {
        console.error('Error removiendo asesor de tabla:', error);
        res.status(500).json({
            success: false,
            error: 'Error al remover asesor de tabla'
        });
    }
};

/**
 * GET /api/advisors/stats
 * Obtener estadísticas de asignaciones
 */
exports.getStats = async (req, res) => {
    try {
        const clientId = req.user.clientId;

        // Contar asesores totales y activos
        const totalAdvisors = await Advisor.countDocuments({ clientId });
        const activeAdvisors = await Advisor.countDocuments({ clientId, active: true });

        // Contar asignaciones a tablas
        const totalAssignments = await AdvisorTableAssignment.countDocuments({ clientId });

        // Obtener configuración
        const config = await AdvisorConfig.findOne({ clientId });

        res.json({
            success: true,
            data: {
                totalAdvisors,
                activeAdvisors,
                totalAssignments,
                moduleEnabled: config ? config.enabled : false
            }
        });
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener estadísticas'
        });
    }
};

module.exports = {
    getConfig: exports.getConfig,
    updateConfig: exports.updateConfig,
    getAdvisors: exports.getAdvisors,
    createAdvisor: exports.createAdvisor,
    updateAdvisor: exports.updateAdvisor,
    deleteAdvisor: exports.deleteAdvisor,
    getTableAssignments: exports.getTableAssignments,
    assignToTable: exports.assignToTable,
    removeFromTable: exports.removeFromTable,
    getStats: exports.getStats
};
