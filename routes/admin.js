const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const ResponseModel = require('../models/Response');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// Admin statistics
// GET /api/admin/overview
router.get('/overview', requireAuth, requireAdmin, async (req, res) => {
  try {
    const total = await ResponseModel.countDocuments();
    const byRisk = await ResponseModel.aggregate([
      { $group: { _id: "$prediction.riskLevel", count: { $sum: 1 } } }
    ]);
    const recent = await ResponseModel.find().sort({ createdAt: -1 }).limit(20);

    res.json({ total, byRisk, recent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Export CSV of responses (admin)
router.get('/export-csv', requireAuth, requireAdmin, async (req, res) => {
  try {
    const all = await ResponseModel.find().lean();
    const csvWriter = createCsvWriter({
      path: '/tmp/predict_asd_export.csv',
      header: [
        {id: '_id', title: 'id'},
        {id: 'childName', title: 'childName'},
        {id: 'childAgeMonths', title: 'ageMonths'},
        {id: 'prediction.riskLevel', title: 'riskLevel'},
        {id: 'prediction.probability', title: 'probability'},
        {id: 'createdAt', title: 'createdAt'}
      ],
      append: false
    });

    // Flatten rows (simple)
    const rows = all.map(r => ({
      _id: r._id.toString(),
      childName: r.childName || '',
      childAgeMonths: r.childAgeMonths || '',
      'prediction.riskLevel': r.prediction?.riskLevel || '',
      'prediction.probability': r.prediction?.probability != null ? r.prediction.probability.toFixed(3) : '',
      createdAt: r.createdAt ? r.createdAt.toISOString() : ''
    }));

    await csvWriter.writeRecords(rows);

    res.download('/tmp/predict_asd_export.csv');
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/analytics
router.get('/analytics', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin')
      return res.status(403).json({ error: 'Admin only' });

    const totalUsers = await User.countDocuments();
    const totalAssessments = await Assessment.countDocuments();
    const totalReports = await Report.countDocuments();
    const byRisk = await Assessment.aggregate([
      { $group: { _id: "$risk", count: { $sum: 1 } } }
    ]);

    res.json({ totalUsers, totalAssessments, totalReports, byRisk });
  } catch (err) {
    res.status(500).json({ error: 'Error loading analytics' });
  }
});

// DELETE /api/admin/users/:userId
router.delete('/users/:userId', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin')
      return res.status(403).json({ error: 'Admin only' });
    await User.findByIdAndDelete(req.params.userId);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting user' });
  }
});


module.exports = router;
