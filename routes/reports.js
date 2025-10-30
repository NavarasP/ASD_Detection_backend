const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const { requireAuth } = require('../middleware/auth');

// POST /api/reports/add
router.post('/add', requireAuth, async (req, res) => {
  if (req.user.role !== 'doctor') return res.status(403).json({ error: 'Doctor only' });
  const { childId, text, pdfUrl } = req.body;
  try {
    const report = new Report({ doctorId: req.user.id, childId, text, pdfUrl });
    await report.save();
    // Return the created report object directly to match frontend expectations
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: 'Error adding report' });
  }
});

// GET /api/reports/details/:reportId
// place details route before the param route to avoid shadowing
router.get('/details/:reportId', requireAuth, async (req, res) => {
  try {
    const report = await Report.findById(req.params.reportId);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    // Allow doctors, caretakers (if related), and admins to view
    res.json(report);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching report' });
  }
});

// GET /api/reports/:childId
router.get('/:childId', requireAuth, async (req, res) => {
  try {
    const reports = await Report.find({ childId: req.params.childId });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching reports' });
  }
});


// DELETE /api/reports/:reportId
router.delete('/:reportId', requireAuth, async (req, res) => {
  try {
    const report = await Report.findById(req.params.reportId);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (req.user.role !== 'doctor' && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Not allowed' });

    await Report.findByIdAndDelete(req.params.reportId);
    res.json({ message: 'Report deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting report' });
  }
});


module.exports = router;
