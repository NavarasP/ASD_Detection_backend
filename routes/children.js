const express = require('express');
const router = express.Router();
const Child = require('../models/Child');
const Assessment = require('../models/Assessment');
const { requireAuth } = require('../middleware/auth');

// POST /api/children/add
router.post('/add', requireAuth, async (req, res) => {
  const { name, dob, gender, notes, medicalHistory } = req.body;
  try {
    const child = new Child({
      caretakerId: req.user.id,
      name,
      dob,
      gender,
      notes,
      medicalHistory: medicalHistory || '',
      authorizedDoctors: []
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

// GET /api/children/authorized (for doctors)
router.get('/authorized', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({ error: 'Access denied. Only doctors can use this endpoint.' });
    }

    const singleMode = String(process.env.SINGLE_DOCTOR_MODE).toLowerCase() === 'true';

    // In single doctor mode return all children automatically
    const baseFilter = singleMode ? {} : { authorizedDoctors: req.user.id };
    const children = await Child.find(baseFilter)
      .populate('caretakerId', 'name email')
      .sort({ createdAt: -1 });

    // Enrich with latest assessment info & risk
    const enriched = await Promise.all(children.map(async (child) => {
      const latest = await Assessment.find({ childId: child._id })
        .sort({ createdAt: -1 })
        .limit(1);
      const last = latest[0];
      const obj = child.toObject();
      if (last) {
        obj.lastAssessmentDate = last.createdAt;
        obj.riskLevel = last.risk;
        obj.status = 'completed';
      } else {
        obj.status = 'pending';
      }
      return obj;
    }));

    res.json({ success: true, data: enriched });
  } catch (err) {
    console.error('Error fetching authorized children:', err);
    res.status(500).json({ error: 'Error fetching authorized children' });
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
  } catch (err) {
    res.status(500).json({ error: 'Error deleting child' });
  }
});

// GET /api/children/:childId  (single child)
router.get('/:childId', requireAuth, async (req, res) => {
  try {
    const child = await Child.findById(req.params.childId);
    if (!child) return res.status(404).json({ error: 'Child not found' });

    // Authorization check:
    // - Caretaker who owns the child
    // - Admin (full access)
    // - Doctor with approved access
    const isOwner = child.caretakerId.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    const isAuthorizedDoctor = req.user.role === 'doctor' && 
      child.authorizedDoctors.some(docId => docId.toString() === req.user.id);

    if (!isOwner && !isAdmin && !isAuthorizedDoctor) {
      return res.status(403).json({ error: 'Access denied. Request access from caretaker first.' });
    }

    res.json(child);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching child' });
  }
});

// GET /api/children/:childId/authorized-doctors
router.get('/:childId/authorized-doctors', requireAuth, async (req, res) => {
  try {
    const child = await Child.findById(req.params.childId).populate('authorizedDoctors', 'name email phone');
    
    if (!child) {
      return res.status(404).json({ error: 'Child not found' });
    }

    // Only caretaker can view authorized doctors list
    if (child.caretakerId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(child.authorizedDoctors || []);
  } catch (err) {
    console.error('Error fetching authorized doctors:', err);
    res.status(500).json({ error: 'Error fetching authorized doctors' });
  }
});

module.exports = router;



