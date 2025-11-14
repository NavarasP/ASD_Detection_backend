const express = require('express');
const router = express.Router();
const Assessment = require('../models/Assessment');
const Child = require('../models/Child');
const Questionnaire = require('../models/Questionnaire');
const { requireAuth } = require('../middleware/auth');
const { analyzeAssessment } = require('../utils/llm-service');

// Dynamic scoring function based on questionnaire's scoringRules
function computeScore(answers, questionnaire) {
  const answerValues = Object.values(answers || {});

  // Helper: detect numeric-coded options like "0 Never", "1 Sometimes" and build a map
  const buildOptionScoreMap = (opts = []) => {
    const map = new Map();
    opts.forEach((opt, idx) => {
      if (typeof opt === 'string') {
        const m = opt.match(/^\s*(\d+)\s+/);
        if (m) {
          map.set(opt, Number(m[1]));
        } else {
          map.set(opt, idx); // fallback to index scoring
        }
      }
    });
    return map;
  };

  let totalScore = 0;

  if (answerValues.every(v => typeof v === 'string' && (v.toLowerCase() === 'yes' || v.toLowerCase() === 'no'))) {
    // Yes/No style → count yes
    totalScore = answerValues.filter(a => (a || '').toLowerCase() === 'yes').length;
  } else if (Array.isArray(questionnaire.answerOptions) && questionnaire.answerOptions.length > 0) {
    // Multi-choice using shared answerOptions across questions
    const scoreMap = buildOptionScoreMap(questionnaire.answerOptions);
    totalScore = answerValues.reduce((sum, val) => {
      if (typeof val !== 'string') return sum;
      // Try exact match first
      if (scoreMap.has(val)) return sum + (scoreMap.get(val) || 0);
      // If not exact, try case-insensitive match
      const found = [...scoreMap.keys()].find(k => k.toLowerCase() === val.toLowerCase());
      if (found) return sum + (scoreMap.get(found) || 0);
      return sum;
    }, 0);
  } else {
    // Fallback: try parse numeric strings (e.g., '0', '1', '2')
    totalScore = answerValues.reduce((sum, v) => {
      const n = Number(v);
      return Number.isFinite(n) ? sum + n : sum;
    }, 0);
  }

  // Determine risk via scoringRules if present, else fallback thresholds
  let risk = 'Low';
  if (questionnaire.scoringRules && questionnaire.scoringRules.length > 0) {
    for (const rule of questionnaire.scoringRules) {
      const inRange = totalScore >= rule.minScore &&
        (rule.maxScore === undefined || totalScore <= rule.maxScore);
      if (inRange) { risk = rule.riskLevel; break; }
    }
  } else {
    // Generic fallback thresholds for yes/no-like totals
    if (totalScore >= 3 && totalScore <= 6) risk = 'Medium';
    else if (totalScore > 6) risk = 'High';
  }

  return { score: totalScore, risk };
}

// POST /api/assessments/add
router.post('/add', requireAuth, async (req, res) => {
  const { childId, questionnaireId, answers } = req.body;
  console.log('[Assessment] Received submission:', { childId, questionnaireId, answerCount: Object.keys(answers || {}).length });
  
  try {
    // Validate required fields
    if (!childId || !questionnaireId || !answers) {
      console.error('[Assessment] Missing required fields:', { childId: !!childId, questionnaireId: !!questionnaireId, answers: !!answers });
      return res.status(400).json({ error: 'childId, questionnaireId, and answers are required' });
    }

    // Fetch questionnaire to get scoring rules and name
    const questionnaire = await Questionnaire.findById(questionnaireId);
    if (!questionnaire) {
      console.error('[Assessment] Questionnaire not found:', questionnaireId);
      return res.status(404).json({ error: 'Questionnaire not found' });
    }
    console.log('[Assessment] Found questionnaire:', questionnaire.name, 'with', questionnaire.questions.length, 'questions');
    
    const { score, risk } = computeScore(answers, questionnaire);
    console.log('[Assessment] Computed score:', score, 'risk:', risk);
    
    // Get child info for LLM context
    const child = await Child.findById(childId);
    if (!child) {
      console.error('[Assessment] Child not found:', childId);
      return res.status(404).json({ error: 'Child not found' });
    }
    console.log('[Assessment] Found child:', child.name);
    const childAge = child && child.dob 
      ? Math.floor((Date.now() - new Date(child.dob).getTime()) / (1000 * 60 * 60 * 24 * 30))
      : null;

    const assessment = new Assessment({
      childId,
      caretakerId: req.user.id,
      questionnaireId,
      type: questionnaire.name, // Store questionnaire name for backward compatibility
      answers,
      score,
      risk
    });

    // Save assessment immediately without LLM analysis
    await assessment.save();
    console.log('[Assessment] Saved assessment (core data only):', assessment._id);

    // Return saved assessment immediately - LLM analysis can be generated later by doctor
    const populatedAssessment = await Assessment.findById(assessment._id).populate('questionnaireId');
    res.json(populatedAssessment);
  } catch (err) {
    console.error('[Assessment] Error saving assessment:', err.message);
    console.error(err.stack);
    res.status(500).json({ error: 'Error saving assessment: ' + err.message });
  }
});
// GET /api/assessments/details/:assessmentId (details)
// IMPORTANT: put detail/static routes before the param route to avoid shadowing
router.get('/details/:assessmentId', requireAuth, async (req, res) => {
  try {
    const assessment = await Assessment.findById(req.params.assessmentId)
      .populate('questionnaireId');
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });
    res.json(assessment);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching assessment' });
  }
});

// GET /api/assessments/:childId  (list for child)
router.get('/:childId', requireAuth, async (req, res) => {
  try {
    const assessments = await Assessment.find({ childId: req.params.childId })
      .populate('questionnaireId');
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
