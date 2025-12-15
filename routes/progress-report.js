const express = require('express');
const router = express.Router();
const Assessment = require('../models/Assessment');
const Report = require('../models/Report');
const Child = require('../models/Child');
const { requireAuth } = require('../middleware/auth');
const { analyzeProgressWithLocalLLM } = require('../utils/local-llm-service');

/**
 * POST /api/reports/generate-progress
 * Generate progress report comparing all attempts
 */
router.post('/generate-progress', requireAuth, async (req, res) => {
  const { childId, compareAllAttempts } = req.body;

  try {
    console.log('[Progress Report] Generating for child:', childId);

    // Fetch all assessments for this child
    const assessments = await Assessment.find({ childId })
      .populate('questionnaireId')
      .sort({ attemptNumber: 1, createdAt: 1 });

    if (assessments.length === 0) {
      return res.status(404).json({ error: 'No assessments found for this child' });
    }

    // Check if there are multiple attempts
    const uniqueAttempts = new Set(assessments.map(a => a.attemptNumber || 1));
    if (uniqueAttempts.size < 2) {
      return res.status(400).json({ 
        error: 'Progress report requires at least 2 completed attempts for comparison' 
      });
    }

    // Fetch child data
    const child = await Child.findById(childId);
    if (!child) {
      return res.status(404).json({ error: 'Child not found' });
    }

    // Group assessments by attempt number
    const attemptGroups = {};
    assessments.forEach(assessment => {
      const attemptNum = assessment.attemptNumber || 1;
      if (!attemptGroups[attemptNum]) {
        attemptGroups[attemptNum] = [];
      }
      attemptGroups[attemptNum].push(assessment);
    });

    // Calculate child age
    const childAge = child.dob 
      ? Math.floor((Date.now() - new Date(child.dob).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
      : null;

    // Prepare data for LLM analysis
    const progressData = {
      childInfo: {
        name: child.name,
        age: childAge,
        gender: child.gender,
        dob: child.dob
      },
      totalAttempts: uniqueAttempts.size,
      attemptGroups: Object.entries(attemptGroups).map(([attemptNum, assessmentsInAttempt]) => ({
        attemptNumber: Number(attemptNum),
        date: assessmentsInAttempt[0].createdAt,
        assessments: assessmentsInAttempt.map(a => ({
          type: a.type,
          score: a.score,
          risk: a.risk,
          answers: a.answers,
          questionnaireName: a.questionnaireId?.name || a.type
        }))
      }))
    };

    console.log('[Progress Report] Analyzing progress with LLM...');
    console.log('[Progress Report] Total attempts:', progressData.totalAttempts);

    // Generate progress analysis with LLM
    const progressAnalysis = await analyzeProgressWithLocalLLM(progressData);

    // Format comprehensive progress report
    const reportText = formatProgressReport(progressData, progressAnalysis);

    // Save progress report to database
    const report = new Report({
      doctorId: req.user.id,
      childId: child._id,
      text: reportText,
      metadata: {
        reportType: 'progress',
        totalAttempts: progressData.totalAttempts,
        generatedBy: 'AI Progress Analyzer',
        analysisDate: new Date()
      }
    });

    await report.save();

    console.log('[Progress Report] Progress report generated successfully');

    res.json({
      success: true,
      report: report,
      progressAnalysis: progressAnalysis
    });

  } catch (error) {
    console.error('[Progress Report] Error:', error);
    res.status(500).json({ 
      error: 'Failed to generate progress report',
      details: error.message 
    });
  }
});

/**
 * Helper: Format progress report text
 */
function formatProgressReport(progressData, analysis) {
  const { childInfo, totalAttempts, attemptGroups } = progressData;
  
  let text = `AUTISM SCREENING PROGRESS REPORT
${'='.repeat(70)}

PATIENT INFORMATION:
- Name: ${childInfo.name}
- Current Age: ${childInfo.age} months
- Gender: ${childInfo.gender}
- Total Assessment Attempts: ${totalAttempts}
- Report Generated: ${new Date().toLocaleDateString()}

${'='.repeat(70)}

OVERALL PROGRESS SUMMARY:
${analysis.overallSummary}

${'='.repeat(70)}

DETAILED ATTEMPT COMPARISON:
`;

  // Add each attempt's summary
  attemptGroups.forEach(attempt => {
    text += `
Attempt ${attempt.attemptNumber} - ${new Date(attempt.date).toLocaleDateString()}
${'-'.repeat(70)}
Assessments Completed: ${attempt.assessments.length}
`;
    attempt.assessments.forEach(assessment => {
      text += `  • ${assessment.questionnaireName}: Score ${assessment.score}, Risk: ${assessment.risk}\n`;
    });
  });

  text += `
${'='.repeat(70)}

KEY OBSERVATIONS:
${analysis.keyObservations.map((obs, i) => `${i + 1}. ${obs}`).join('\n')}

${'='.repeat(70)}

TREND ANALYSIS:
${analysis.trendAnalysis}

${'='.repeat(70)}

IMPROVEMENT AREAS:
${analysis.improvementAreas.map((area, i) => `${i + 1}. ${area}`).join('\n')}

${'='.repeat(70)}

AREAS OF CONCERN:
${analysis.concernAreas.map((concern, i) => `${i + 1}. ${concern}`).join('\n')}

${'='.repeat(70)}

CLINICAL RECOMMENDATIONS:
${analysis.recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')}

${'='.repeat(70)}

NEXT STEPS:
${analysis.nextSteps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

${'='.repeat(70)}

DISCLAIMER:
This progress report is generated based on screening assessment data and AI analysis. 
It should be used as a supplementary tool alongside professional clinical judgment. 
A comprehensive evaluation by a qualified healthcare professional is recommended for 
definitive diagnosis and treatment planning.

Report Generated: ${new Date().toLocaleString()}
Generated By: ${analysis.generatedBy || 'AI Progress Analyzer'}
`;

  return text;
}

module.exports = router;
