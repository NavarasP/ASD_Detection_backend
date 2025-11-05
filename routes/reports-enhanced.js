const express = require('express');
const router = express.Router();
const Assessment = require('../models/Assessment');
const Report = require('../models/Report');
const Child = require('../models/Child');
const { requireAuth } = require('../middleware/auth');
const { analyzeAssessmentWithLocalLLM, generateMedicalReport } = require('../utils/local-llm-service');

/**
 * POST /api/reports/generate-from-assessment
 * Generate AI-powered report from assessment data
 */
router.post('/generate-from-assessment', requireAuth, async (req, res) => {
  if (req.user.role !== 'doctor') {
    return res.status(403).json({ error: 'Only doctors can generate reports' });
  }

  const { assessmentId, childId, additionalNotes } = req.body;

  try {
    // Fetch assessment data
    const assessment = await Assessment.findById(assessmentId)
      .populate('questionnaireId')
      .populate('childId');

    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    // Fetch child data
    const child = await Child.findById(childId || assessment.childId);
    
    if (!child) {
      return res.status(404).json({ error: 'Child not found' });
    }

    // Calculate child age in months
    const childAge = child.dob 
      ? Math.floor((Date.now() - new Date(child.dob).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
      : null;

    // Prepare assessment data
    const assessmentData = {
      type: assessment.type || assessment.questionnaireId?.type || 'MCHAT',
      answers: assessment.answers,
      score: assessment.score,
      risk: assessment.risk,
      childAge: childAge,
      childInfo: {
        name: child.name,
        gender: child.gender,
        dob: child.dob
      },
      createdAt: assessment.createdAt
    };

    console.log('[Report Generator] Analyzing assessment with local LLM...');

    // Generate AI analysis
    const analysis = await analyzeAssessmentWithLocalLLM(assessmentData);

    // Generate comprehensive report
    const reportData = await generateMedicalReport(assessmentData, analysis);

    // Format report text
    const reportText = formatReportText(reportData, additionalNotes);

    // Save report to database
    const report = new Report({
      doctorId: req.user.id,
      childId: child._id,
      text: reportText,
      assessmentId: assessmentId,
      analysis: analysis, // Store AI analysis
      metadata: {
        generatedBy: analysis.generatedBy,
        confidenceScore: analysis.confidenceScore,
        riskLevel: analysis.riskLevel
      }
    });

    await report.save();

    // Update assessment with analysis
    assessment.llmAnalysis = {
      summary: analysis.summary,
      recommendations: analysis.recommendations.join('\n'),
      keyFindings: analysis.keyFindings,
      generatedAt: new Date()
    };
    assessment.reviewedByDoctor = req.user.id;
    assessment.reviewedAt = new Date();
    await assessment.save();

    console.log('[Report Generator] Report generated successfully');

    res.json({
      success: true,
      report: report,
      analysis: analysis,
      reportData: reportData
    });

  } catch (error) {
    console.error('[Report Generator] Error:', error);
    res.status(500).json({ 
      error: 'Failed to generate report',
      details: error.message 
    });
  }
});

/**
 * POST /api/reports/add
 * Add manual report (existing functionality)
 */
router.post('/add', requireAuth, async (req, res) => {
  if (req.user.role !== 'doctor') {
    return res.status(403).json({ error: 'Doctor only' });
  }
  
  const { childId, text, pdfUrl, assessmentId } = req.body;
  
  try {
    const report = new Report({ 
      doctorId: req.user.id, 
      childId, 
      text, 
      pdfUrl,
      assessmentId 
    });
    await report.save();
    res.json(report);
  } catch (err) {
    console.error('[Reports] Add error:', err);
    res.status(500).json({ error: 'Error adding report' });
  }
});

/**
 * GET /api/reports/assessment/:assessmentId
 * Get report for specific assessment
 */
router.get('/assessment/:assessmentId', requireAuth, async (req, res) => {
  try {
    const report = await Report.findOne({ assessmentId: req.params.assessmentId })
      .populate('doctorId', 'name email')
      .populate('childId', 'name dob gender');
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    res.json(report);
  } catch (err) {
    console.error('[Reports] Fetch by assessment error:', err);
    res.status(500).json({ error: 'Error fetching report' });
  }
});

/**
 * GET /api/reports/details/:reportId
 */
router.get('/details/:reportId', requireAuth, async (req, res) => {
  try {
    const report = await Report.findById(req.params.reportId)
      .populate('doctorId', 'name email specialization')
      .populate('childId', 'name dob gender');
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json(report);
  } catch (err) {
    console.error('[Reports] Fetch details error:', err);
    res.status(500).json({ error: 'Error fetching report' });
  }
});

/**
 * GET /api/reports/:childId
 * Get all reports for a child
 */
router.get('/:childId', requireAuth, async (req, res) => {
  try {
    const reports = await Report.find({ childId: req.params.childId })
      .populate('doctorId', 'name email')
      .sort({ createdAt: -1 });
    
    res.json(reports);
  } catch (err) {
    console.error('[Reports] Fetch by child error:', err);
    res.status(500).json({ error: 'Error fetching reports' });
  }
});

/**
 * DELETE /api/reports/:reportId
 */
router.delete('/:reportId', requireAuth, async (req, res) => {
  try {
    const report = await Report.findById(req.params.reportId);
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not allowed' });
    }

    await Report.findByIdAndDelete(req.params.reportId);
    res.json({ message: 'Report deleted successfully' });
  } catch (err) {
    console.error('[Reports] Delete error:', err);
    res.status(500).json({ error: 'Error deleting report' });
  }
});

/**
 * Helper: Format report text for display
 */
function formatReportText(reportData, additionalNotes) {
  const { patientInfo, assessmentDetails, clinicalSummary, keyFindings, recommendations, notes, disclaimer } = reportData;
  
  let text = `AUTISM SCREENING ASSESSMENT REPORT
${'='.repeat(60)}

PATIENT INFORMATION:
- Name: ${patientInfo.name}
- Age: ${patientInfo.age}
- Gender: ${patientInfo.gender}
- Assessment Date: ${new Date(patientInfo.assessmentDate).toLocaleDateString()}

ASSESSMENT DETAILS:
- Type: ${assessmentDetails.type}
- Score: ${assessmentDetails.score}
- Risk Level: ${assessmentDetails.riskLevel}
- Confidence Score: ${(assessmentDetails.confidenceScore * 100).toFixed(0)}%

${'='.repeat(60)}

CLINICAL SUMMARY:
${clinicalSummary}

${'='.repeat(60)}

KEY FINDINGS:
${keyFindings.map((finding, i) => `${i + 1}. ${finding}`).join('\n')}

${'='.repeat(60)}

RECOMMENDATIONS:
${recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')}

${'='.repeat(60)}

ADDITIONAL NOTES:
${additionalNotes || 'No additional notes provided by the reviewing physician.'}

${'='.repeat(60)}

IMPORTANT DISCLAIMER:
${disclaimer}

PROFESSIONAL NOTES:
${notes}

${'='.repeat(60)}

Report Generated: ${new Date().toLocaleString()}
Generated By: ${reportData.generatedBy}
Reviewing Physician: [Doctor's signature required]

---
This report is confidential and intended for medical professionals and authorized caregivers only.
`;

  return text;
}

module.exports = router;
