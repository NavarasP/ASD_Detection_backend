const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const Child = require('../models/Child');
const User = require('../models/User');
const Assessment = require('../models/Assessment');

// GET /api/search/children?query=
router.get('/children', requireAuth, async (req, res) => {
  try {
    const q = req.query.query || '';
    const children = await Child.find({ name: { $regex: q, $options: 'i' } })
      .populate('caretakerId', 'name email')
      .limit(20);

    // Fetch latest assessment for each child
    const childrenWithRisk = await Promise.all(
      children.map(async (c) => {
        const latestAssessment = await Assessment.findOne({ childId: c._id })
          .sort({ createdAt: -1 })
          .select('risk createdAt score');

        return {
          id: c._id,
          name: c.name,
          caretaker: c.caretakerId?.name,
          gender: c.gender,
          riskLevel: latestAssessment?.risk || 'Unknown',
          lastAssessmentDate: latestAssessment?.createdAt || null,
          lastAssessmentScore: latestAssessment?.score || null
        };
      })
    );

    res.json(childrenWithRisk);
  } catch (err) {
    console.error('Search failed:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
