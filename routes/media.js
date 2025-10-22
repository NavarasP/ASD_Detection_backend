const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { requireAuth } = require('../middleware/auth');
const mongoose = require('mongoose');

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const upload = multer({ dest: 'uploads/' });

const MediaSchema = new mongoose.Schema({
  childId: { type: mongoose.Schema.Types.ObjectId, ref: 'Child', required: true },
  fileUrl: { type: String, required: true },
  fileType: { type: String },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});
const Media = mongoose.model('Media', MediaSchema);

// POST /api/media/upload
router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const { childId, fileType } = req.body;
    const result = await cloudinary.uploader.upload(req.file.path, { resource_type: "auto" });
    const media = new Media({
      childId,
      fileType,
      fileUrl: result.secure_url,
      uploadedBy: req.user.id
    });
    await media.save();
    res.json({ url: result.secure_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// DELETE /api/media/:mediaId
router.delete('/:mediaId', requireAuth, async (req, res) => {
  try {
    const media = await Media.findById(req.params.mediaId);
    if (!media) return res.status(404).json({ error: 'File not found' });
    if (req.user.role !== 'caretaker' && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Not allowed' });

    await Media.findByIdAndDelete(req.params.mediaId);
    res.json({ message: 'Media deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting file' });
  }
});


module.exports = router;
