const express = require('express');
const router = express.Router();
const Assessment = require('../models/Assessment');
const Child = require('../models/Child');
const { requireAuth } = require('../middleware/auth');
const { analyzeAssessment } = require('../utils/llm-service');

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
    
    // Get child info for LLM context
    const child = await Child.findById(childId);
    const childAge = child && child.dob 
      ? Math.floor((Date.now() - new Date(child.dob).getTime()) / (1000 * 60 * 60 * 24 * 30))
      : null;

    const assessment = new Assessment({
      childId,
      caretakerId: req.user.id,
      type,
      answers,
      score,
      risk
    });

    // Generate LLM analysis asynchronously (don't block the response)
    // Store the promise and await it in the background
    const analysisPromise = analyzeAssessment({
      type,
      answers,
      score,
      risk,
      childAge
    }).then(analysis => {
      // Update assessment with LLM analysis
      assessment.llmAnalysis = {
        summary: analysis.summary,
        recommendations: analysis.recommendations,
        keyFindings: analysis.keyFindings,
        generatedAt: new Date()
      };
      return assessment.save();
    }).catch(err => {
      console.error('[Assessment] LLM analysis failed:', err);
      // Continue without LLM analysis if it fails
    });

    // Save assessment immediately (without LLM analysis initially)
    await assessment.save();

    // Wait for LLM analysis (with timeout)
    try {
      await Promise.race([
        analysisPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);
      // Fetch the updated assessment with LLM analysis
      const updatedAssessment = await Assessment.findById(assessment._id);
      res.json(updatedAssessment);
    } catch (timeoutErr) {
      // If LLM takes too long, return assessment without analysis
      // Analysis will be available on next fetch
      res.json(assessment);
    }
  } catch (err) {
    console.error(err);
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

// POST /api/assessments/:assessmentId/analyze - Regenerate LLM analysis (doctor only)
router.post('/:assessmentId/analyze', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only doctors can request analysis' });
    }

    const assessment = await Assessment.findById(req.params.assessmentId).populate('childId');
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });

    // Check doctor has access to this child
    const child = assessment.childId;
    const hasAccess = req.user.role === 'admin' || 
      child.authorizedDoctors.some(docId => docId.toString() === req.user.id);
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this child\'s records' });
    }

    // Calculate child age
    const childAge = child && child.dob 
      ? Math.floor((Date.now() - new Date(child.dob).getTime()) / (1000 * 60 * 60 * 24 * 30))
      : null;

    // Generate LLM analysis
    const analysis = await analyzeAssessment({
      type: assessment.type,
      answers: assessment.answers,
      score: assessment.score,
      risk: assessment.risk,
      childAge
    });

    // Update assessment
    assessment.llmAnalysis = {
      summary: analysis.summary,
      recommendations: analysis.recommendations,
      keyFindings: analysis.keyFindings,
      generatedAt: new Date()
    };
    assessment.reviewedByDoctor = req.user.id;
    assessment.reviewedAt = new Date();

    await assessment.save();

    res.json({ 
      message: 'Analysis generated successfully',
      assessment 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error generating analysis' });
  }
});


module.exports = router;
