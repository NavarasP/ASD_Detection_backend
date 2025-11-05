const express = require('express');
const router = express.Router();
const { analyzeAssessmentWithLocalLLM, isOllamaAvailable } = require('../utils/local-llm-service');
const { requireAuth } = require('../middleware/auth');

/**
 * GET /api/llm/status
 * Check LLM service status
 */
router.get('/status', async (req, res) => {
  try {
    const ollamaAvailable = await isOllamaAvailable();
    
    res.json({
      success: true,
      ollama: {
        available: ollamaAvailable,
        url: process.env.OLLAMA_URL || 'http://localhost:11434',
        model: process.env.OLLAMA_MODEL || 'llama2'
      },
      fallbackMode: !ollamaAvailable,
      message: ollamaAvailable 
        ? 'Local LLM (Ollama) is available and ready'
        : 'Using rule-based expert system (Ollama not available)'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/llm/test
 * Test LLM analysis with sample data
 */
router.post('/test', requireAuth, async (req, res) => {
  if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Doctors and admins only' });
  }

  try {
    // Sample assessment data for testing
    const sampleData = {
      type: 'MCHAT',
      answers: {
        'Does your child look at you when you call his/her name?': 'No',
        'How easy is it for you to get eye contact with your child?': 'Difficult',
        'Does your child point to indicate that s/he wants something?': 'No',
        'Does your child point to share interest with you?': 'No',
        'Does your child pretend?': 'No',
        'Does your child follow where you\'re looking?': 'No',
        'If you point at a toy, does your child look at it?': 'No',
        'Does your child try to get you to watch them?': 'No',
        'Does your child smile back when you smile?': 'Sometimes',
        'Does your child copy what you do?': 'Rarely'
      },
      score: 8,
      risk: 'High',
      childAge: 24, // 24 months
      childInfo: {
        name: 'Test Child',
        gender: 'Male',
        dob: new Date(Date.now() - 24 * 30 * 24 * 60 * 60 * 1000)
      },
      createdAt: new Date()
    };

    console.log('[LLM Test] Starting analysis with sample data...');
    const startTime = Date.now();

    const analysis = await analyzeAssessmentWithLocalLLM(sampleData);

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    console.log(`[LLM Test] Analysis completed in ${duration.toFixed(2)}s`);

    res.json({
      success: true,
      analysis: analysis,
      performance: {
        duration: `${duration.toFixed(2)}s`,
        generatedBy: analysis.generatedBy
      },
      sampleData: sampleData
    });

  } catch (error) {
    console.error('[LLM Test] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
