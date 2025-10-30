const express = require('express');
const router = express.Router();
const Child = require('../models/Child');
const { requireAuth } = require('../middleware/auth');

// POST /api/children/add
router.post('/add', requireAuth, async (req, res) => {
  const { name, dob, gender, notes } = req.body;
  try {
    const child = new Child({
      caretakerId: req.user.id,
      name,
      dob,
      gender,
      notes
    });
    await child.save();
    res.json(child);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error adding child' });
  }
});

// GET /api/children/my
router.get('/my', requireAuth, async (req, res) => {
  try {
    const children = await Child.find({ caretakerId: req.user.id });
    res.json(children);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching children' });
  }
});



// PUT /api/children/:childId
router.put('/:childId', requireAuth, async (req, res) => {
  try {
    const child = await Child.findOneAndUpdate(
      { _id: req.params.childId, caretakerId: req.user.id },
      req.body,
      { new: true }
    );
    if (!child) return res.status(404).json({ error: 'Child not found' });
    res.json({ message: 'Child updated successfully', child });
  } catch (err) {
    res.status(500).json({ error: 'Error updating child' });
  }
});

// DELETE /api/children/:childId
router.delete('/:childId', requireAuth, async (req, res) => {
  try {
    const deleted = await Child.findOneAndDelete({
      _id: req.params.childId,
      caretakerId: req.user.id
    });
    if (!deleted) return res.status(404).json({ error: 'Child not found' });
    res.json({ message: 'Child removed' });

// GET /api/children/:childId  (single child)
router.get('/:childId', requireAuth, async (req, res) => {
  try {
    const child = await Child.findById(req.params.childId);
    if (!child) return res.status(404).json({ error: 'Child not found' });

    // Only owner (caretaker) or admin/doctor should view
    if (child.caretakerId.toString() !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'doctor')
      return res.status(403).json({ error: 'Forbidden' });

    res.json(child);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching child' });
  }
});
  } catch (err) {
    res.status(500).json({ error: 'Error deleting child' });
  }
});

module.exports = router;



