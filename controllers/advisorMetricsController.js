const Advisor = require('../models/Advisor');
const CustomTable = require('../models/CustomTable');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const mongoose = require('mongoose');

// Get metrics for all advisors of a client
exports.getAdvisorMetrics = async (req, res) => {
    try {
        // Determine clientId based on role
        let clientId;
        if (req.user.role === 'admin') {
            clientId = req.query.clientId;
            if (!clientId) {
                return res.status(400).json({ msg: 'Se requiere clientId para admin' });
            }
        } else {
            clientId = req.user.clientId;
        }

        // Get all advisors for this client
        const advisors = await Advisor.find({ clientId, active: true });
        console.log(`📊 METRICS: Found ${advisors.length} advisors for clientId: ${clientId}`);

        const metrics = [];

        for (const advisor of advisors) {
            // Get all phone numbers assigned to this advisor from Mis Datos
            const assignedPhoneNumbers = new Set();

            const tables = await CustomTable.find({ clientId, isActive: true });

            for (const table of tables) {
                const collectionName = table.collectionName;
                let DataModel;

                if (mongoose.models[collectionName]) {
                    DataModel = mongoose.models[collectionName];
                } else {
                    DataModel = mongoose.model(
                        collectionName,
                        new mongoose.Schema(table.getValidationSchema()),
                        collectionName
                    );
                }

                const phoneFields = table.fields.filter(f =>
                    f.type === 'phone' || f.name.toLowerCase().includes('telefono') || f.name.toLowerCase().includes('phone')
                );

                for (const phoneField of phoneFields) {
                    const records = await DataModel.find({
                        assignedAdvisorId: advisor._id.toString()
                    }).select(phoneField.name);

                    records.forEach(record => {
                        const phoneValue = record[phoneField.name];
                        if (phoneValue) {
                            assignedPhoneNumbers.add(String(phoneValue));
                        }
                    });
                }
            }

            // Count chats matching these phone numbers
            const totalChats = await Message.aggregate([
                {
                    $match: {
                        clientId: clientId,
                        chatId: { $in: Array.from(assignedPhoneNumbers) }
                    }
                },
                {
                    $group: {
                        _id: '$chatId'
                    }
                },
                {
                    $count: 'total'
                }
            ]);

            const chatCount = totalChats.length > 0 ? totalChats[0].total : 0;

            // Get tag statistics for these chats
            const tagStats = await Chat.aggregate([
                {
                    $match: {
                        clientId: clientId,
                        chatId: { $in: Array.from(assignedPhoneNumbers) },
                        tags: { $exists: true, $ne: [] }
                    }
                },
                {
                    $unwind: '$tags'
                },
                {
                    $group: {
                        _id: '$tags',
                        count: { $sum: 1 }
                    }
                },
                {
                    $sort: { count: -1 }
                }
            ]);

            // Count chats with at least one tag
            const taggedChatsCount = await Chat.countDocuments({
                clientId: clientId,
                chatId: { $in: Array.from(assignedPhoneNumbers) },
                tags: { $exists: true, $ne: [] }
            });

            // Build tag breakdown object
            const tagBreakdown = {};
            tagStats.forEach(stat => {
                tagBreakdown[stat._id] = stat.count;
            });

            metrics.push({
                advisorId: advisor._id,
                advisorName: advisor.name,
                advisorEmail: advisor.email,
                totalChats: chatCount,
                taggedChats: taggedChatsCount,
                tagBreakdown
            });
        }

        res.json(metrics);
    } catch (error) {
        console.error('Error obteniendo métricas de asesores:', error);
        res.status(500).json({ msg: 'Error obteniendo métricas de asesores' });
    }
};
