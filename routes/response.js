const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ResponseModel = require('../models/Response');
const { evaluateRisk } = require('../utils/ml'); // our heuristic evaluator

// POST /api/responses/submit
// Accepts: { childName, childAgeMonths, answers: { q1: 0-3, q2: 0-3, ... }, meta: {...} }
router.post('/submit', requireAuth, async (req, res) => {
  const { childName, childAgeMonths, answers, meta } = req.body;
  if (!answers || typeof answers !== 'object') return res.status(400).json({ error: 'answers required' });

  try {
    // Run the evaluator
    const prediction = evaluateRisk(answers);

    const resp = new ResponseModel({
      userId: req.user.id,
      childName,
      childAgeMonths,
      answers,
      meta,
      prediction
    });

    await resp.save();
    res.json({ id: resp._id, prediction });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Optionally anonymous submit (if you want to allow no account)
// POST /api/responses/submit-anon
router.post('/submit-anon', async (req, res) => {
  const { childName, childAgeMonths, answers, meta } = req.body;
  if (!answers || typeof answers !== 'object') return res.status(400).json({ error: 'answers required' });

  try {
    const prediction = evaluateRisk(answers);
    const resp = new ResponseModel({
      childName,
      childAgeMonths,
      answers,
      meta,
      prediction
    });

    await resp.save();
    res.json({ id: resp._id, prediction });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/responses/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const doc = await ResponseModel.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    // Only owner or admin should view - simple ownership check
    if (doc.userId && doc.userId.toString() !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Forbidden' });

    res.json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
