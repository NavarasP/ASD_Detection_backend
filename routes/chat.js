const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const mongoose = require('mongoose');

const ChatMessage = mongoose.model('ChatMessage', new mongoose.Schema({
  childId: { type: mongoose.Schema.Types.ObjectId, ref: 'Child', required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: String,
  timestamp: { type: Date, default: Date.now }
}));

// GET /api/chat/messages/:childId
router.get('/messages/:childId', requireAuth, async (req, res) => {
  try {
    const messages = await ChatMessage.find({ childId: req.params.childId }).sort({ timestamp: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching chat messages' });
  }
});

module.exports = router;
