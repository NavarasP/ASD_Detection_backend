const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const Assessment = require('../models/Assessment');
const Child = require('../models/Child');
const Report = require('../models/Report');
const User = require('../models/User');

// GET /api/admin/overview
router.get('/admin/overview', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin')
      return res.status(403).json({ error: 'Admin only' });

    const totalUsers = await User.countDocuments();
    const totalChildren = await Child.countDocuments();
    const totalAssessments = await Assessment.countDocuments();
    const byRisk = await Assessment.aggregate([
      { $group: { _id: "$risk", count: { $sum: 1 } } }
    ]);

    res.json({ totalUsers, totalChildren, totalAssessments, byRisk });
  } catch (err) {
    res.status(500).json({ error: 'Error fetching dashboard' });
  }
});

// GET /api/caretaker/dashboard
router.get('/caretaker/dashboard', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'caretaker')
      return res.status(403).json({ error: 'Caretaker only' });

    const children = await Child.find({ caretakerId: req.user.id });
    const reports = await Report.find({ childId: { $in: children.map(c => c._id) } })
      .sort({ createdAt: -1 }).limit(5);

    res.json({
      childrenCount: children.length,
      latestReports: reports.map(r => ({
        childId: r.childId,
        summary: r.text,
        pdfUrl: r.pdfUrl
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Error loading caretaker dashboard' });
  }
});

// GET /api/doctor/dashboard
router.get('/doctor/dashboard', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'doctor')
      return res.status(403).json({ error: 'Doctor only' });

    const totalReports = await Report.countDocuments({ doctorId: req.user.id });
    const recentReports = await Report.find({ doctorId: req.user.id }).sort({ createdAt: -1 }).limit(5);
    res.json({ totalReports, recentReports });
  } catch (err) {
    res.status(500).json({ error: 'Error loading doctor dashboard' });
  }
});

module.exports = router;
