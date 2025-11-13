const express = require('express');
const router = express.Router();
const Questionnaire = require('../models/Questionnaire');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const multer = require('multer');
const { parse } = require('csv-parse');
const upload = multer({ storage: multer.memoryStorage() });

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

// POST /api/questionnaires/bulk - Bulk create questionnaires (Admin only)
router.post('/bulk', requireAuth, requireAdmin, async (req, res) => {
  try {
    const payload = Array.isArray(req.body) ? req.body : req.body.items;
    if (!Array.isArray(payload) || payload.length === 0) {
      return res.status(400).json({ error: 'Provide an array of questionnaires in request body (or { items: [...] })' });
    }

    // Normalize and validate minimal required fields
    const docs = payload.map((q, idx) => {
      if (!q || !q.name || !q.fullName || !Array.isArray(q.questions)) {
        throw new Error(`Invalid questionnaire at index ${idx}: requires name, fullName, questions[]`);
      }
      return {
        name: q.name,
        fullName: q.fullName,
        description: q.description || '',
        questions: q.questions.map((qq, qi) => ({
          text: qq.text,
          order: typeof qq.order === 'number' ? qq.order : qi
        })),
        answerOptions: Array.isArray(q.answerOptions) && q.answerOptions.length > 0 ? q.answerOptions : ["yes", "no", "sometimes"],
        scoringRules: Array.isArray(q.scoringRules) ? q.scoringRules : [],
        scoringInfo: q.scoringInfo || '',
        duration: q.duration || '',
        ageRange: q.ageRange || '',
        isActive: q.isActive !== undefined ? q.isActive : true,
        createdBy: req.user.id
      };
    });

    const result = await Questionnaire.insertMany(docs, { ordered: false });
    res.json({ message: 'Bulk import completed', insertedCount: result.length });
  } catch (err) {
    console.error('[Questionnaire] Bulk import error:', err);
    // If some docs failed but others were inserted, provide partial success details when possible
    if (err && err.writeErrors) {
      const inserted = (err.result && err.result.result && err.result.result.nInserted) || 0;
      return res.status(207).json({
        message: 'Bulk import partially completed',
        insertedCount: inserted,
        error: 'Some records failed to insert',
      });
    }
    res.status(500).json({ error: 'Error importing questionnaires' });
  }
});

// POST /api/questionnaires/import-csv (Admin only)
// multipart/form-data: file, name, fullName, duration, ageRange, isActive?, questionColumn, optionColumns[]
router.post('/import-csv', requireAuth, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'CSV file is required (field name: file)' });

    const {
      name,
      fullName,
      description = '',
      duration = '',
      ageRange = '',
      isActive = 'true',
      questionColumn = 'Question',
      optionColumns // comma-separated or array
    } = req.body || {};

    if (!name || !fullName) {
      return res.status(400).json({ error: 'name and fullName are required' });
    }

    const optCols = Array.isArray(optionColumns)
      ? optionColumns
      : (typeof optionColumns === 'string' && optionColumns.length > 0
        ? optionColumns.split(',').map(s => s.trim())
        : []);

    const records = [];
    await new Promise((resolve, reject) => {
      parse(req.file.buffer, {
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true,
        trim: true,
      })
        .on('readable', function() {
          let record;
          // eslint-disable-next-line no-cond-assign
          while (record = this.read()) {
            records.push(record);
          }
        })
        .on('error', reject)
        .on('end', resolve);
    });

    if (records.length === 0) {
      return res.status(400).json({ error: 'CSV appears to be empty or invalid' });
    }

    // Determine global answerOptions from first valid data row using provided option columns
    // If not provided, attempt to infer from row values beyond the question column for known formats
    const findFirstQuestionRow = () => {
      for (const r of records) {
        const q = r[questionColumn];
        // skip section headers or empty
        if (q && !/section/i.test(q)) {
          // If there's a Serial No. column and it's not numeric, skip
          const ser = r['Serial No.'] || r['Serial No'] || '';
          if (ser && !/^\d+/.test(String(ser))) continue;
          return r;
        }
      }
      return null;
    };

    const firstRow = findFirstQuestionRow();
    if (!firstRow) return res.status(400).json({ error: 'No question rows detected in CSV' });

    let answerOptions = [];
    if (optCols.length > 0) {
      answerOptions = optCols.map(c => firstRow[c]).filter(Boolean);
    } else {
      // Infer by taking all columns except the question and common metadata columns
      const exclude = new Set([questionColumn, 'Serial No.', 'Serial No', 'Section']);
      answerOptions = Object.keys(firstRow)
        .filter(k => !exclude.has(k))
        .map(k => firstRow[k])
        .filter(Boolean);
    }
    if (answerOptions.length === 0) {
      // Default fallback
      answerOptions = ['yes', 'no'];
    }

    // Build questions list
    const questions = [];
    for (const r of records) {
      const q = r[questionColumn];
      if (!q || /section/i.test(q)) continue;
      const ser = r['Serial No.'] || r['Serial No'] || '';
      if (ser && !/^\d+/.test(String(ser))) continue;
      questions.push({ text: String(q), order: questions.length });
    }

    const doc = new Questionnaire({
      name,
      fullName,
      description,
      questions,
      answerOptions,
      scoringRules: [],
      scoringInfo: '',
      duration,
      ageRange,
      isActive: String(isActive).toLowerCase() !== 'false',
      createdBy: req.user.id,
    });

    await doc.save();
    res.json({ message: 'Questionnaire imported from CSV', questionnaire: doc, questionCount: questions.length });
  } catch (err) {
    console.error('[Questionnaire] CSV import error:', err);
    res.status(500).json({ error: 'Error importing CSV' });
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
