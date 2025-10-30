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
    // Return the saved assessment so frontend receives the created resource
    res.json(assessment);
  } catch (err) {
    res.status(500).json({ error: 'Error saving assessment' });
  }
});
// GET /api/assessments/:assessmentId (details)
// IMPORTANT: put detail/static routes before the param route to avoid shadowing
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

// GET /api/assessments/:childId  (list for child)
router.get('/:childId', requireAuth, async (req, res) => {
  try {
    const assessments = await Assessment.find({ childId: req.params.childId });
    res.json(assessments);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching assessments' });
  }
});

// DELETE /api/assessments/:assessmentId
router.delete('/:assessmentId', requireAuth, async (req, res) => {
  try {
    const assessment = await Assessment.findById(req.params.assessmentId);
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });

    // Only the caretaker who created it or an admin can delete
    if (assessment.caretakerId.toString() !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Not allowed' });

    await Assessment.findByIdAndDelete(req.params.assessmentId);
    res.json({ message: 'Assessment deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error deleting assessment' });
  }
});


module.exports = router;
