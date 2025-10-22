const express = require('express');
const router = express.Router();
const Assessment = require('../models/Assessment');
const { requireAuth } = require('../middleware/auth');

// simple scoring function
function computeMchatScore(answers) {
  const score = Object.values(answers).reduce((a, b) => a + Number(b || 0), 0);
  let risk = 'Low';
  if (score >= 3 && score <= 6) risk = 'Medium';
  else if (score > 6) risk = 'High';
  return { score, risk };
}

// POST /api/assessments/add
router.post('/add', requireAuth, async (req, res) => {
  const { childId, type, answers } = req.body;
  try {
    const { score, risk } = computeMchatScore(answers);
    const assessment = new Assessment({
      childId,
      caretakerId: req.user.id,
      type,
      answers,
      score,
      risk
    });
    await assessment.save();
    res.json({ message: 'Assessment saved', score, risk });
  } catch (err) {
    res.status(500).json({ error: 'Error saving assessment' });
  }
});

// GET /api/assessments/:childId
router.get('/:childId', requireAuth, async (req, res) => {
  try {
    const assessments = await Assessment.find({ childId: req.params.childId });
    res.json(assessments);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching assessments' });
  }
});


// GET /api/assessments/:assessmentId
router.get('/details/:assessmentId', requireAuth, async (req, res) => {
  try {
    const assessment = await Assessment.findById(req.params.assessmentId);
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });
    res.json(assessment);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching assessment' });
  }
});

// GET /api/questionnaires
router.get('/questionnaires', requireAuth, async (req, res) => {
  try {
    const templates = [
      { type: 'MCHAT', questions: 23 },
      { type: 'SCQ', questions: 40 },
      { type: 'TABC', questions: 30 }
    ];
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching templates' });
  }
});


module.exports = router;
