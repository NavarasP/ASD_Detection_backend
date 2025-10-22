const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const Child = require('../models/Child');
const User = require('../models/User');

// GET /api/search/children?query=
router.get('/children', requireAuth, async (req, res) => {
  try {
    const q = req.query.query || '';
    const children = await Child.find({ name: { $regex: q, $options: 'i' } })
      .populate('caretakerId', 'name email')
      .limit(20);

    res.json(children.map(c => ({
      id: c._id,
      name: c.name,
      caretaker: c.caretakerId?.name,
      gender: c.gender
    })));
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
