const fs = require('fs');
const path = require('path');
const Sticker = require('../models/Sticker');

const DEFAULT_STICKERS = [
  { id: 'preset-hola', name: 'Hola', emoji: '👋', accent: '#25D366', textColor: '#103529', category: 'saludos' },
  { id: 'preset-gracias', name: 'Gracias', emoji: '🙏', accent: '#FFE082', textColor: '#5C4300', category: 'saludos' },
  { id: 'preset-ok', name: 'Ok', emoji: '👌', accent: '#90CAF9', textColor: '#0D3557', category: 'rapidas' },
  { id: 'preset-genial', name: 'Genial', emoji: '✨', accent: '#F8BBD0', textColor: '#5E2144', category: 'rapidas' },
  { id: 'preset-volvemos', name: 'Volvemos', emoji: '⏳', accent: '#D1C4E9', textColor: '#34224D', category: 'gestion' },
  { id: 'preset-oferta', name: 'Oferta', emoji: '🔥', accent: '#FFCCBC', textColor: '#6B2414', category: 'ventas' },
];

function resolveClientId(req) {
  return req.user.clientId || req.query.clientId || req.body.clientId;
}

function ensureStickerDir(clientId) {
  const dirPath = path.join(__dirname, '..', 'public', 'stickers', clientId);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

exports.getStickers = async (req, res) => {
  try {
    const clientId = resolveClientId(req);
    if (!clientId) {
      return res.status(400).json({ msg: 'Se requiere clientId' });
    }

    const customStickers = await Sticker.find({ clientId }).sort({ createdAt: -1 }).lean();

    res.json({
      defaults: DEFAULT_STICKERS,
      custom: customStickers,
    });
  } catch (error) {
    console.error('Error obteniendo stickers:', error);
    res.status(500).json({ msg: 'Error del servidor', error: error.message });
  }
};

exports.createSticker = async (req, res) => {
  try {
    const clientId = resolveClientId(req);
    if (!clientId) {
      return res.status(400).json({ msg: 'Se requiere clientId' });
    }

    if (!req.file) {
      return res.status(400).json({ msg: 'Se requiere un archivo .webp' });
    }

    if (req.file.mimetype !== 'image/webp') {
      return res.status(400).json({ msg: 'El sticker debe estar en formato WEBP' });
    }

    if (req.file.size > 100 * 1024) {
      return res.status(400).json({ msg: 'El sticker no puede superar 100 KB' });
    }

    const rawName = (req.body.name || 'Sticker').trim();
    const safeName = rawName.slice(0, 80) || 'Sticker';
    const category = (req.body.category || 'custom').trim().slice(0, 40) || 'custom';

    const dirPath = ensureStickerDir(clientId);
    const fileBaseName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
    const filePath = path.join(dirPath, fileBaseName);
    fs.writeFileSync(filePath, req.file.buffer);

    const sticker = await Sticker.create({
      clientId,
      name: safeName,
      category,
      fileUrl: `/stickers/${clientId}/${fileBaseName}`,
      mimeType: req.file.mimetype,
      size: req.file.size,
      createdBy: req.user.id || req.user.userId || null,
    });

    res.status(201).json({ sticker });
  } catch (error) {
    console.error('Error creando sticker:', error);
    res.status(500).json({ msg: 'Error del servidor', error: error.message });
  }
};

exports.getStickerFile = async (req, res) => {
  try {
    const clientId = resolveClientId(req);
    if (!clientId) {
      return res.status(400).json({ msg: 'Se requiere clientId' });
    }

    const sticker = await Sticker.findOne({ _id: req.params.id, clientId }).lean();
    if (!sticker) {
      return res.status(404).json({ msg: 'Sticker no encontrado' });
    }

    const relativePath = sticker.fileUrl.replace(/^\//, '').split('/').join(path.sep);
    const filePath = path.join(__dirname, '..', 'public', relativePath);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ msg: 'Archivo de sticker no encontrado' });
    }

    res.set('Content-Type', sticker.mimeType || 'image/webp');
    return res.sendFile(filePath);
  } catch (error) {
    console.error('Error obteniendo archivo de sticker:', error);
    res.status(500).json({ msg: 'Error del servidor', error: error.message });
  }
};

exports.deleteSticker = async (req, res) => {
  try {
    const clientId = resolveClientId(req);
    if (!clientId) {
      return res.status(400).json({ msg: 'Se requiere clientId' });
    }

    const sticker = await Sticker.findOne({ _id: req.params.id, clientId });
    if (!sticker) {
      return res.status(404).json({ msg: 'Sticker no encontrado' });
    }

    const relativePath = sticker.fileUrl.replace(/^\//, '').split('/').join(path.sep);
    const filePath = path.join(__dirname, '..', 'public', relativePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await sticker.deleteOne();
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando sticker:', error);
    res.status(500).json({ msg: 'Error del servidor', error: error.message });
  }
};
