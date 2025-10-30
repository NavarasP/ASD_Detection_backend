const express = require('express');
const router = express.Router();
const Questionnaire = require('../models/Questionnaire');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// POST /api/questionnaires/create - Create new questionnaire (Admin only)
router.post('/create', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, fullName, description, questions, answerOptions, scoringRules, scoringInfo, duration, ageRange } = req.body;
    
    const questionnaire = new Questionnaire({
      name,
      fullName,
      description,
      questions,
      answerOptions: answerOptions || ["yes", "no", "sometimes"],
      scoringRules,
      scoringInfo,
      duration,
      ageRange,
      isActive: true,
      createdBy: req.user.id
    });

    await questionnaire.save();
    res.json({ message: 'Questionnaire created successfully', questionnaire });
  } catch (err) {
    console.error('[Questionnaire] Create error:', err);
    res.status(500).json({ error: 'Error creating questionnaire' });
  }
});

// GET /api/questionnaires/active - Get all active questionnaires (for caretakers)
router.get('/active', requireAuth, async (req, res) => {
  try {
    const questionnaires = await Questionnaire.find({ isActive: true })
      .select('-createdBy -__v')
      .sort({ createdAt: -1 });
    res.json(questionnaires);
  } catch (err) {
    console.error('[Questionnaire] Fetch active error:', err);
    res.status(500).json({ error: 'Error fetching questionnaires' });
  }
});

// GET /api/questionnaires/all - Get all questionnaires (Admin only)
router.get('/all', requireAuth, requireAdmin, async (req, res) => {
  try {
    const questionnaires = await Questionnaire.find()
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    res.json(questionnaires);
  } catch (err) {
    console.error('[Questionnaire] Fetch all error:', err);
    res.status(500).json({ error: 'Error fetching questionnaires' });
  }
});

// GET /api/questionnaires/:id - Get single questionnaire
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const questionnaire = await Questionnaire.findById(req.params.id);
    if (!questionnaire) {
      return res.status(404).json({ error: 'Questionnaire not found' });
    }
    
    // Only return active questionnaires to non-admin users
    if (!questionnaire.isActive && req.user.role !== 'admin') {
      return res.status(404).json({ error: 'Questionnaire not available' });
    }

    res.json(questionnaire);
  } catch (err) {
    console.error('[Questionnaire] Fetch single error:', err);
    res.status(500).json({ error: 'Error fetching questionnaire' });
  }
});

// PUT /api/questionnaires/:id - Update questionnaire (Admin only)
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, fullName, description, questions, answerOptions, scoringRules, scoringInfo, duration, ageRange, isActive } = req.body;
    
    const questionnaire = await Questionnaire.findById(req.params.id);
    if (!questionnaire) {
      return res.status(404).json({ error: 'Questionnaire not found' });
    }

    // Update fields
    if (name !== undefined) questionnaire.name = name;
    if (fullName !== undefined) questionnaire.fullName = fullName;
    if (description !== undefined) questionnaire.description = description;
    if (questions !== undefined) questionnaire.questions = questions;
    if (answerOptions !== undefined) questionnaire.answerOptions = answerOptions;
    if (scoringRules !== undefined) questionnaire.scoringRules = scoringRules;
    if (scoringInfo !== undefined) questionnaire.scoringInfo = scoringInfo;
    if (duration !== undefined) questionnaire.duration = duration;
    if (ageRange !== undefined) questionnaire.ageRange = ageRange;
    if (isActive !== undefined) questionnaire.isActive = isActive;

    await questionnaire.save();
    res.json({ message: 'Questionnaire updated successfully', questionnaire });
  } catch (err) {
    console.error('[Questionnaire] Update error:', err);
    res.status(500).json({ error: 'Error updating questionnaire' });
  }
});

// DELETE /api/questionnaires/:id - Delete questionnaire (Admin only)
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const questionnaire = await Questionnaire.findById(req.params.id);
    if (!questionnaire) {
      return res.status(404).json({ error: 'Questionnaire not found' });
    }

    await Questionnaire.findByIdAndDelete(req.params.id);
    res.json({ message: 'Questionnaire deleted successfully' });
  } catch (err) {
    console.error('[Questionnaire] Delete error:', err);
    res.status(500).json({ error: 'Error deleting questionnaire' });
  }
});

module.exports = router;
