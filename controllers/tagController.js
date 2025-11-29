const UserTag = require('../models/UserTags');
const Chat = require('../models/Chat');

exports.getUserTags = async (req, res) => {
  try {
    const userId = req.user.id; 
    
    let userTags = await UserTag.findOne({ userId });
    
    if (!userTags) {
      userTags = await UserTag.create({ userId, tags: [] });
    }
    
    res.json({ tags: userTags.tags });
  } catch (error) {
    console.error('Error al obtener tags:', error);
    res.status(500).json({ error: 'Error al obtener tags' });
  }
};

exports.createTag = async (req, res) => {
  try {
    const userId = req.user.id; 
    const { name, color } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'El nombre de la tag es requerido' });
    }
    
    const tagName = name.trim().toLowerCase();
    
    let userTags = await UserTag.findOne({ userId });
    
    if (!userTags) {
      userTags = await UserTag.create({ userId, tags: [] });
    }
    
    const tagExists = userTags.tags.some(tag => tag.name === tagName);
    if (tagExists) {
      return res.status(400).json({ error: 'Esta tag ya existe' });
    }
    
    userTags.tags.push({
      name: tagName,
      color: color || '#df5a98ff'
    });
    
    await userTags.save();
    
    res.status(201).json({ 
      message: 'Tag creada exitosamente',
      tag: userTags.tags[userTags.tags.length - 1]
    });
  } catch (error) {
    console.error('Error al crear tag:', error);
    res.status(500).json({ error: 'Error al crear tag' });
  }
};

exports.updateTagColor = async (req, res) => {
  try {
    const userId = req.user.id; 
    const { tagName } = req.params;
    const { color } = req.body;
    
    if (!color) {
      return res.status(400).json({ error: 'El color es requerido' });
    }
    
    const userTags = await UserTag.findOne({ userId });
    
    if (!userTags) {
      return res.status(404).json({ error: 'No se encontraron tags' });
    }
    
    const tag = userTags.tags.find(t => t.name === tagName.toLowerCase());
    
    if (!tag) {
      return res.status(404).json({ error: 'Tag no encontrada' });
    }
    
    tag.color = color;
    await userTags.save();
    
    res.json({ 
      message: 'Color actualizado exitosamente',
      tag 
    });
  } catch (error) {
    console.error('Error al actualizar color:', error);
    res.status(500).json({ error: 'Error al actualizar color' });
  }
};

exports.deleteTag = async (req, res) => {
  try {
    const userId = req.user.id;
    const { tagName } = req.params;
    const tagNameLower = tagName.toLowerCase();
    
    const userTags = await UserTag.findOne({ userId });
    
    if (!userTags) {
      return res.status(404).json({ error: 'No se encontraron tags' });
    }
    
    userTags.tags = userTags.tags.filter(t => t.name !== tagNameLower);
    await userTags.save();
    
    const clientId = req.user.clientId;
    
    if (clientId) {
      await Chat.updateMany(
        { clientId, tags: tagNameLower },
        { $pull: { tags: tagNameLower } }
      );
    }
    
    res.json({ message: 'Tag eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar tag:', error);
    res.status(500).json({ error: 'Error al eliminar tag' });
  }
};

exports.addTagToChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { tag } = req.body;
    const clientId = req.user.clientId;
    
    if (!tag || tag.trim() === '') {
      return res.status(400).json({ error: 'El nombre de la tag es requerido' });
    }
    
    const tagName = tag.trim().toLowerCase();
    
    const chat = await Chat.findOne({ chatId, clientId });
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat no encontrado' });
    }
    
    if (chat.tags.includes(tagName)) {
      return res.status(400).json({ error: 'Esta tag ya está asignada al chat' });
    }
    
    chat.tags.push(tagName);
    await chat.save();
    
    res.json({ 
      message: 'Tag agregada exitosamente',
      tags: chat.tags 
    });
  } catch (error) {
    console.error('Error al agregar tag:', error);
    res.status(500).json({ error: 'Error al agregar tag' });
  }
};

exports.removeTagFromChat = async (req, res) => {
  try {
    const { chatId, tagName } = req.params;
    const clientId = req.user.clientId;
    const tagNameLower = tagName.toLowerCase();
    
    const chat = await Chat.findOne({ chatId, clientId });
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat no encontrado' });
    }
    
    chat.tags = chat.tags.filter(t => t !== tagNameLower);
    await chat.save();
    
    res.json({ 
      message: 'Tag removida exitosamente',
      tags: chat.tags 
    });
  } catch (error) {
    console.error('Error al remover tag:', error);
    res.status(500).json({ error: 'Error al remover tag' });
  }
};

exports.updateChatTags = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { tags } = req.body;
    const clientId = req.user.clientId;
    
    if (!Array.isArray(tags)) {
      return res.status(400).json({ error: 'Tags debe ser un array' });
    }
    
    const chat = await Chat.findOne({ chatId, clientId });
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat no encontrado' });
    }
    
    chat.tags = tags.map(t => t.trim().toLowerCase()).filter(t => t !== '');
    await chat.save();
    
    res.json({ 
      message: 'Tags actualizadas exitosamente',
      tags: chat.tags 
    });
  } catch (error) {
    console.error('Error al actualizar tags:', error);
    res.status(500).json({ error: 'Error al actualizar tags' });
  }
};

exports.getTagStats = async (req, res) => {
  try {
    const clientId = req.user.clientId;
    
    const stats = await Chat.aggregate([
      { $match: { clientId } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    res.json({ stats });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
};