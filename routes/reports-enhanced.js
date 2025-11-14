const express = require('express');
const router = express.Router();
const Assessment = require('../models/Assessment');
const Report = require('../models/Report');
const Child = require('../models/Child');
const Questionnaire = require('../models/Questionnaire');
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
  console.log('[Reports-Enhanced] Add report request from user:', req.user.id, 'role:', req.user.role);
  if (req.user.role !== 'doctor') {
    console.log('[Reports-Enhanced] Access denied - not a doctor');
    return res.status(403).json({ error: 'Doctor only' });
  }
  
  const { childId, text, pdfUrl, assessmentId } = req.body;
  console.log('[Reports-Enhanced] Report data:', { childId, textLength: text?.length, pdfUrl, assessmentId });
  
  try {
    const report = new Report({ 
      doctorId: req.user.id, 
      childId, 
      text, 
      pdfUrl,
      assessmentId 
    });
    await report.save();
    console.log('[Reports-Enhanced] Report saved successfully:', report._id);
    res.json(report);
  } catch (err) {
    console.error('[Reports-Enhanced] Add error:', err.message);
    console.error('[Reports-Enhanced] Stack:', err.stack);
    res.status(500).json({ error: 'Error adding report: ' + err.message });
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

/**
 * POST /api/reports/generate-combined
 * Generate comprehensive report from ALL assessments for a child
 * Accessible to both caretakers and doctors
 */
router.post('/generate-combined', requireAuth, async (req, res) => {
  const { childId } = req.body;
  console.log('[CombinedReport] Request for childId:', childId, 'by user:', req.user.id);

  try {
    if (!childId) {
      return res.status(400).json({ error: 'childId is required' });
    }

    // Fetch child
    const child = await Child.findById(childId);
    if (!child) {
      return res.status(404).json({ error: 'Child not found' });
    }

    // Verify access (caretaker must own child, or be a doctor/admin)
    const isCaretaker = child.caretakerId.toString() === req.user.id;
    const isDoctor = req.user.role === 'doctor';
    const isAdmin = req.user.role === 'admin';

    if (!isCaretaker && !isDoctor && !isAdmin) {
      return res.status(403).json({ error: 'You do not have access to this child' });
    }

    // Fetch ALL assessments for this child
    const assessments = await Assessment.find({ childId })
      .populate('questionnaireId')
      .sort({ createdAt: 1 });

    if (assessments.length === 0) {
      return res.status(400).json({ error: 'No assessments found for this child' });
    }

    console.log('[CombinedReport] Found', assessments.length, 'assessments');

    // Calculate child age
    const childAge = child.dob 
      ? Math.floor((Date.now() - new Date(child.dob).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
      : null;

    // Build combined analysis data
    const combinedData = {
      child: {
        name: child.name,
        age: childAge,
        dob: child.dob,
        gender: child.gender
      },
      assessments: assessments.map(a => ({
        type: a.questionnaireId?.name || a.type,
        fullName: a.questionnaireId?.fullName || '',
        score: a.score,
        risk: a.risk,
        date: a.createdAt,
        llmAnalysis: a.llmAnalysis,
        answerCount: Object.keys(a.answers || {}).length
      }))
    };

    // Generate combined report text
    let reportText = `COMPREHENSIVE AUTISM SCREENING REPORT\n${'='.repeat(70)}\n\n`;
    reportText += `CHILD INFORMATION:\n`;
    reportText += `Name: ${child.name}\n`;
    reportText += `Age: ${childAge ? Math.floor(childAge / 12) + ' years ' + (childAge % 12) + ' months' : 'Unknown'}\n`;
    reportText += `Gender: ${child.gender}\n`;
    reportText += `Date of Birth: ${new Date(child.dob).toLocaleDateString()}\n\n`;
    reportText += `${'='.repeat(70)}\n\n`;

    reportText += `ASSESSMENTS COMPLETED: ${assessments.length}\n\n`;

    // Add each assessment summary
    assessments.forEach((assessment, idx) => {
      reportText += `${idx + 1}. ${assessment.questionnaireId?.fullName || assessment.type}\n`;
      reportText += `   Date: ${new Date(assessment.createdAt).toLocaleDateString()}\n`;
      reportText += `   Score: ${assessment.score}\n`;
      reportText += `   Risk Level: ${assessment.risk}\n`;
      
      if (assessment.llmAnalysis?.summary) {
        reportText += `   Analysis: ${assessment.llmAnalysis.summary}\n`;
      }
      
      if (assessment.llmAnalysis?.recommendations) {
        reportText += `   Recommendations: ${assessment.llmAnalysis.recommendations}\n`;
      }
      
      reportText += `\n`;
    });

    reportText += `${'='.repeat(70)}\n\n`;

    // Overall risk assessment
    const highRiskCount = assessments.filter(a => a.risk === 'High').length;
    const mediumRiskCount = assessments.filter(a => a.risk === 'Medium' || a.risk === 'Moderate').length;
    const lowRiskCount = assessments.filter(a => a.risk === 'Low').length;

    reportText += `OVERALL ASSESSMENT SUMMARY:\n\n`;
    reportText += `High Risk Assessments: ${highRiskCount}\n`;
    reportText += `Medium Risk Assessments: ${mediumRiskCount}\n`;
    reportText += `Low Risk Assessments: ${lowRiskCount}\n\n`;

    if (highRiskCount > 0) {
      reportText += `RECOMMENDATION: Immediate consultation with a pediatric specialist is recommended.\n`;
      reportText += `Multiple assessments indicate elevated risk markers for autism spectrum disorder.\n`;
    } else if (mediumRiskCount > 0) {
      reportText += `RECOMMENDATION: Follow-up assessment recommended within 3-6 months.\n`;
      reportText += `Some risk markers present - monitoring and early intervention may be beneficial.\n`;
    } else {
      reportText += `RECOMMENDATION: Continue routine developmental monitoring.\n`;
      reportText += `Current assessments show low risk indicators.\n`;
    }

    reportText += `\n${'='.repeat(70)}\n\n`;
    reportText += `NEXT STEPS:\n`;
    reportText += `1. Share this report with your child's healthcare provider\n`;
    reportText += `2. Discuss findings and recommendations during next visit\n`;
    reportText += `3. Consider early intervention services if recommended\n`;
    reportText += `4. Continue monitoring developmental milestones\n\n`;
    reportText += `Report Generated: ${new Date().toLocaleString()}\n`;
    reportText += `Generated for: ${req.user.role}\n\n`;
    reportText += `This is an automated screening report. Clinical diagnosis requires professional evaluation.\n`;

    // Save the combined report
    const report = new Report({
      childId: child._id,
      doctorId: req.user.id,
      text: reportText,
      createdAt: new Date()
    });

    await report.save();
    console.log('[CombinedReport] Saved report:', report._id);

    res.json({
      success: true,
      report: report,
      assessmentCount: assessments.length,
      summary: {
        highRisk: highRiskCount,
        mediumRisk: mediumRiskCount,
        lowRisk: lowRiskCount
      }
    });

  } catch (err) {
    console.error('[CombinedReport] Error:', err);
    res.status(500).json({ error: 'Failed to generate combined report: ' + err.message });
  }
});

module.exports = router;
