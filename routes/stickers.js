const express = require('express');
const multer = require('multer');
const auth = require('../middleware/auth');
const stickerController = require('../controllers/stickerController');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 },
});

router.get('/', auth, stickerController.getStickers);
router.post('/', auth, upload.single('sticker'), stickerController.createSticker);
router.get('/:id/file', auth, stickerController.getStickerFile);
router.delete('/:id', auth, stickerController.deleteSticker);

module.exports = router;
