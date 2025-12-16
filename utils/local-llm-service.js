/**
 * Local LLM Service for Medical Assessment Analysis
 * 
 * Supported Options:
 * 1. Groq API (Recommended for production) - Fast, free, cloud-based
 * 2. Ollama (Local) - Local LLM server with medical models
 * 3. Rule-based Expert System - Fallback when LLM unavailable
 */

const axios = require('axios');
const Groq = require('groq-sdk');

/**
 * Main entry point for assessment analysis
 * @param {Object} assessmentData - { type, answers, score, risk, childAge, childInfo }
 * @returns {Object} { summary, recommendations, keyFindings, riskLevel, confidenceScore }
 */
async function analyzeAssessmentWithLocalLLM(assessmentData) {
  try {
    console.log('[LLM Service] Starting assessment analysis...');
    
    // Try Groq API first (production)
    if (process.env.GROQ_API_KEY) {
      console.log('[LLM Service] Using Groq API for analysis');
      return await analyzeWithGroq(assessmentData);
    }
    
    // Try Ollama (local development)
    if (await isOllamaAvailable()) {
      console.log('[LLM Service] Using Ollama for analysis');
      return await analyzeWithOllama(assessmentData);
    }
    
    // Fallback to advanced rule-based system
    console.log('[LLM Service] Using rule-based expert system');
    return await advancedRuleBasedAnalysis(assessmentData);
    
  } catch (error) {
    console.error('[LLM Service] Analysis error:', error.message);
    // Final fallback
    return await advancedRuleBasedAnalysis(assessmentData);
  }
}

/**
 * Check if Ollama server is running
 */
async function isOllamaAvailable() {
  try {
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    const response = await axios.get(`${ollamaUrl}/api/tags`, { timeout: 2000 });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

/**
 * Analyze assessment using Groq API (production)
 * Fast, free tier available, works great for serverless
 */
async function analyzeWithGroq(assessmentData) {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || 'llama-3.1-70b-versatile';
  
  const groq = new Groq({ apiKey });
  const prompt = buildMedicalPrompt(assessmentData);
  
  try {
    const completion = await groq.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content: 'You are a pediatric developmental specialist assistant analyzing autism spectrum disorder (ASD) screening assessments. Provide professional, compassionate medical analysis.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3, // Lower temperature for medical accuracy
      max_tokens: 1500
    });
    
    const generatedText = completion.choices[0]?.message?.content || '';
    
    // Parse LLM response
    return parseLLMResponse(generatedText, assessmentData);
    
  } catch (error) {
    console.error('[Groq API] Generation error:', error.message);
    throw error;
  }
}

/**
 * Analyze assessment using Ollama (local LLM)
 * Recommended models: llama2, mistral, medllama2, meditron
 */
async function analyzeWithOllama(assessmentData) {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'llama2'; // Can use medical models
  
  const { type, answers, score, risk, childAge, childInfo } = assessmentData;
  
  // Build detailed prompt
  const prompt = buildMedicalPrompt(assessmentData);
  
  try {
    const response = await axios.post(
      `${ollamaUrl}/api/generate`,
      {
        model: model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3, // Lower temperature for medical accuracy
          top_p: 0.9,
          top_k: 40
        }
      },
      { timeout: 60000 } // 60 second timeout for generation
    );
    
    const generatedText = response.data.response;
    
    // Parse LLM response
    return parseLLMResponse(generatedText, assessmentData);
    
  } catch (error) {
    console.error('[Ollama] Generation error:', error.message);
    throw error;
  }
}

/**
 * Build medical-grade prompt for assessment analysis
 */
function buildMedicalPrompt(assessmentData) {
  const { type, answers, score, risk, childAge, childInfo } = assessmentData;
  
  const ageText = childAge ? `${Math.floor(childAge / 12)} years ${childAge % 12} months` : 'Age not specified';
  const childName = childInfo?.name || 'the child';
  const gender = childInfo?.gender || 'not specified';
  
  // Format answers for readability
  const answersText = Object.entries(answers)
    .map(([question, answer], index) => `Q${index + 1}: ${answer}`)
    .join('\n');
  
  return `You are a pediatric developmental specialist assistant analyzing an autism spectrum disorder (ASD) screening assessment. Provide a professional medical analysis.

PATIENT INFORMATION:
- Child: ${childName}
- Age: ${ageText}
- Gender: ${gender}

ASSESSMENT DETAILS:
- Type: ${type} (${getAssessmentFullName(type)})
- Total Score: ${score}
- Risk Level: ${risk}

RESPONSES:
${answersText}

INSTRUCTIONS:
Please provide a comprehensive analysis in the following format:

1. CLINICAL SUMMARY (2-3 sentences):
Summarize the overall assessment findings and what they indicate.

2. KEY FINDINGS (3-5 bullet points):
List the most significant observations from the responses.

3. RISK ASSESSMENT:
Explain the ${risk} risk level in medical context.

4. RECOMMENDATIONS (3-5 specific actions):
Provide evidence-based next steps for caregivers and healthcare providers.

5. IMPORTANT NOTES:
Any critical considerations or limitations of this screening.

Keep the tone professional but accessible for parents. Focus on facts and avoid speculation. This is a screening tool, not a diagnostic instrument.`;
}

/**
 * Parse LLM response into structured format
 */
function parseLLMResponse(text, assessmentData) {
  // Extract sections using regex
  const summaryMatch = text.match(/CLINICAL SUMMARY[:\s]+(.*?)(?=KEY FINDINGS|$)/is);
  const findingsMatch = text.match(/KEY FINDINGS[:\s]+(.*?)(?=RISK ASSESSMENT|$)/is);
  const recommendationsMatch = text.match(/RECOMMENDATIONS[:\s]+(.*?)(?=IMPORTANT NOTES|$)/is);
  const notesMatch = text.match(/IMPORTANT NOTES[:\s]+(.*?)$/is);
  
  // Extract bullet points
  const keyFindings = findingsMatch 
    ? findingsMatch[1]
        .split('\n')
        .filter(line => line.trim().match(/^[-•*\d.]/))
        .map(line => line.replace(/^[-•*\d.)\s]+/, '').trim())
        .filter(line => line.length > 10)
    : [];
  
  const recommendations = recommendationsMatch
    ? recommendationsMatch[1]
        .split('\n')
        .filter(line => line.trim().match(/^[-•*\d.]/))
        .map(line => line.replace(/^[-•*\d.)\s]+/, '').trim())
        .filter(line => line.length > 10)
    : [];
  
  return {
    summary: summaryMatch ? summaryMatch[1].trim() : text.substring(0, 500),
    keyFindings: keyFindings.length > 0 ? keyFindings : [
      'Assessment completed successfully',
      `Risk level identified: ${assessmentData.risk}`,
      'Further professional evaluation recommended'
    ],
    recommendations: recommendations.length > 0 ? recommendations : [
      'Consult with a pediatrician or developmental specialist',
      'Consider comprehensive diagnostic evaluation',
      'Monitor developmental milestones closely'
    ],
    riskLevel: assessmentData.risk,
    confidenceScore: calculateConfidenceScore(assessmentData),
    notes: notesMatch ? notesMatch[1].trim() : 'This is a screening tool, not a diagnostic assessment.',
    generatedBy: 'Local LLM (Ollama)',
    generatedAt: new Date()
  };
}

/**
 * Advanced rule-based analysis (fallback)
 * Based on clinical guidelines and research
 */
async function advancedRuleBasedAnalysis(assessmentData) {
  const { type, answers, score, risk, childAge, childInfo } = assessmentData;
  
  const ageText = childAge ? `${Math.floor(childAge / 12)} years ${childAge % 12} months` : 'not specified';
  const childName = childInfo?.name || 'the child';
  
  // Generate summary based on assessment type and risk
  const summary = generateSummary(type, score, risk, ageText, childName);
  
  // Generate key findings
  const keyFindings = generateKeyFindings(type, answers, score, risk);
  
  // Generate recommendations
  const recommendations = generateRecommendations(type, risk, childAge);
  
  return {
    summary,
    keyFindings,
    recommendations,
    riskLevel: risk,
    confidenceScore: calculateConfidenceScore(assessmentData),
    notes: 'This screening indicates the need for further evaluation. Only a qualified healthcare professional can make a diagnosis.',
    generatedBy: 'Rule-Based Expert System',
    generatedAt: new Date()
  };
}

/**
 * Generate clinical summary
 */
function generateSummary(type, score, risk, ageText, childName) {
  const assessmentName = getAssessmentFullName(type);
  
  const summaries = {
    'High': `${childName} (age: ${ageText}) completed the ${assessmentName} screening with a score of ${score}, indicating a HIGH risk for autism spectrum disorder (ASD). This result suggests significant developmental concerns that warrant immediate professional evaluation. Multiple red flags were identified across key developmental domains including social communication, repetitive behaviors, and sensory processing.`,
    
    'Moderate': `${childName} (age: ${ageText}) completed the ${assessmentName} screening with a score of ${score}, indicating a MODERATE risk for autism spectrum disorder (ASD). Several developmental concerns were identified that require follow-up with a qualified healthcare professional. Further assessment is strongly recommended to determine if intervention services are needed.`,
    
    'Medium': `${childName} (age: ${ageText}) completed the ${assessmentName} screening with a score of ${score}, indicating a MEDIUM risk for autism spectrum disorder (ASD). Some developmental concerns were noted that should be monitored closely. A comprehensive evaluation by a developmental pediatrician or psychologist is advised to rule out ASD or identify any developmental delays.`,
    
    'Low': `${childName} (age: ${ageText}) completed the ${assessmentName} screening with a score of ${score}, indicating a LOW risk for autism spectrum disorder (ASD). The screening did not identify significant concerns at this time. However, continued monitoring of developmental milestones is recommended as part of routine pediatric care.`
  };
  
  return summaries[risk] || summaries['Medium'];
}

/**
 * Generate key findings based on answers
 */
function generateKeyFindings(type, answers, score, risk) {
  const findings = [];
  
  // Score-based finding
  findings.push(`Total screening score: ${score} points (${risk} risk category)`);
  
  // Analyze answer patterns
  const totalQuestions = Object.keys(answers).length;
  const concerningAnswers = Object.values(answers).filter(ans => 
    ans === 'Yes' || ans === 'Often' || ans === 'Frequently' || ans === 'Always'
  ).length;
  
  if (concerningAnswers > totalQuestions * 0.5) {
    findings.push(`Significant number of concerning responses (${concerningAnswers}/${totalQuestions} questions flagged)`);
  } else if (concerningAnswers > totalQuestions * 0.3) {
    findings.push(`Moderate number of developmental concerns identified (${concerningAnswers}/${totalQuestions} questions flagged)`);
  } else {
    findings.push(`Limited concerning responses noted (${concerningAnswers}/${totalQuestions} questions flagged)`);
  }
  
  // Type-specific findings
  if (type === 'MCHAT' || type === 'M-CHAT') {
    findings.push('Assessment focused on early autism indicators including social attention, communication, and play behaviors');
    if (risk === 'High') {
      findings.push('Multiple critical items failed, suggesting possible deficits in joint attention and social reciprocity');
    }
  } else if (type === 'SCQ') {
    findings.push('Comprehensive screening covering social interaction, communication patterns, and restricted/repetitive behaviors');
  } else if (type === 'TABC') {
    findings.push('Thorough assessment of autism behavioral characteristics across multiple developmental domains');
  }
  
  // Risk-specific findings
  if (risk === 'High') {
    findings.push('Results indicate urgent need for comprehensive diagnostic evaluation by autism specialists');
    findings.push('Early intervention services should be considered immediately to support development');
  } else if (risk === 'Moderate' || risk === 'Medium') {
    findings.push('Follow-up assessment recommended within 1-3 months to monitor developmental progress');
  }
  
  return findings;
}

/**
 * Generate evidence-based recommendations
 */
function generateRecommendations(type, risk, childAge) {
  const recommendations = [];
  
  if (risk === 'High') {
    recommendations.push('URGENT: Schedule comprehensive diagnostic evaluation with developmental pediatrician, psychologist, or autism specialist within 2-4 weeks');
    recommendations.push('Contact early intervention services immediately (ages 0-3) or school district special education (ages 3+) to begin eligibility assessment');
    recommendations.push('Request referral to speech-language pathologist and occupational therapist for baseline assessments');
    recommendations.push('Document specific behavioral concerns with video recordings to share with specialists');
    recommendations.push('Join autism support groups and connect with other families for resources and emotional support');
  } else if (risk === 'Moderate' || risk === 'Medium') {
    recommendations.push('Schedule appointment with developmental pediatrician or child psychologist for comprehensive evaluation within 4-8 weeks');
    recommendations.push('Request developmental screening during next well-child visit with pediatrician');
    recommendations.push('Monitor and document developmental milestones, social interactions, and any concerning behaviors');
    recommendations.push('Consider speech and language evaluation if communication delays are present');
    recommendations.push('Research early intervention programs and support services available in your area');
  } else {
    recommendations.push('Continue routine developmental monitoring at regular pediatric check-ups');
    recommendations.push('Repeat screening in 6-12 months or if new concerns arise');
    recommendations.push('Maintain open communication with childcare providers and teachers about developmental progress');
    recommendations.push('Support healthy development through age-appropriate social interactions and play activities');
  }
  
  // Age-specific recommendations
  if (childAge && childAge < 36) {
    recommendations.push('Early intervention is most effective - seek services as soon as possible if concerns exist');
  }
  
  return recommendations;
}

/**
 * Calculate confidence score based on assessment quality
 */
function calculateConfidenceScore(assessmentData) {
  let confidence = 0.7; // Base confidence
  
  const { answers, score, childAge } = assessmentData;
  const totalQuestions = Object.keys(answers).length;
  
  // More questions = higher confidence
  if (totalQuestions >= 20) confidence += 0.1;
  if (totalQuestions >= 30) confidence += 0.1;
  
  // Age provided = higher confidence
  if (childAge) confidence += 0.05;
  
  // Score extremes = higher confidence
  if (score === 0 || score > totalQuestions * 0.7) {
    confidence += 0.05;
  }
  
  return Math.min(confidence, 0.95); // Cap at 95%
}

/**
 * Get full assessment name
 */
function getAssessmentFullName(type) {
  const names = {
    'MCHAT': 'Modified Checklist for Autism in Toddlers (M-CHAT)',
    'M-CHAT': 'Modified Checklist for Autism in Toddlers (M-CHAT)',
    'SCQ': 'Social Communication Questionnaire (SCQ)',
    'TABC': 'Toddler Autism Behavior Checklist (TABC)',
    'AQ': 'Autism Quotient (AQ)',
    'CARS': 'Childhood Autism Rating Scale (CARS)'
  };
  
  return names[type] || type;
}

/**
 * Generate comprehensive medical report for doctor
 */
async function generateMedicalReport(assessmentData, analysis) {
  const { childInfo, type, score, risk, childAge, createdAt } = assessmentData;
  
  const report = {
    title: `Autism Screening Assessment Report - ${type}`,
    patientInfo: {
      name: childInfo?.name || 'Patient',
      age: childAge ? `${Math.floor(childAge / 12)} years ${childAge % 12} months` : 'Not specified',
      gender: childInfo?.gender || 'Not specified',
      assessmentDate: createdAt || new Date()
    },
    assessmentDetails: {
      type: getAssessmentFullName(type),
      score: score,
      riskLevel: risk,
      confidenceScore: analysis.confidenceScore
    },
    clinicalSummary: analysis.summary,
    keyFindings: analysis.keyFindings,
    recommendations: analysis.recommendations,
    notes: analysis.notes,
    disclaimer: 'This screening assessment is NOT a diagnostic tool. Only qualified healthcare professionals can diagnose autism spectrum disorder. Results should be interpreted in the context of clinical observation and comprehensive evaluation.',
    generatedBy: analysis.generatedBy,
    generatedAt: analysis.generatedAt
  };
  
  return report;
}

/**
 * Analyze progress across multiple assessment attempts
 * @param {Object} progressData - { childInfo, totalAttempts, attemptGroups }
 * @returns {Object} Progress analysis with trends and recommendations
 */
async function analyzeProgressWithLocalLLM(progressData) {
  try {
    console.log('[Local LLM] Starting progress analysis...');
    
    // Try Ollama first
    if (await isOllamaAvailable()) {
      console.log('[Local LLM] Using Ollama for progress analysis');
      return await analyzeProgressWithOllama(progressData);
    }
    
    // Fallback to rule-based progress analysis
    console.log('[Local LLM] Using rule-based progress analysis');
    return await ruleBasedProgressAnalysis(progressData);
    
  } catch (error) {
    console.error('[Local LLM] Progress analysis error:', error.message);
    return await ruleBasedProgressAnalysis(progressData);
  }
}

/**
 * Analyze progress using Ollama
 */
async function analyzeProgressWithOllama(progressData) {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'llama2';
  
  const prompt = buildProgressPrompt(progressData);
  
  try {
    const response = await axios.post(
      `${ollamaUrl}/api/generate`,
      {
        model: model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3,
          top_p: 0.9,
          top_k: 40
        }
      },
      { timeout: 90000 }
    );
    
    const generatedText = response.data.response;
    return parseProgressResponse(generatedText, progressData);
    
  } catch (error) {
    console.error('[Ollama] Progress analysis error:', error.message);
    throw error;
  }
}

/**
 * Build prompt for progress analysis
 */
function buildProgressPrompt(progressData) {
  const { childInfo, totalAttempts, attemptGroups } = progressData;
  
  let prompt = `You are a pediatric developmental specialist analyzing autism screening progress over multiple assessment attempts.

PATIENT: ${childInfo.name}, ${childInfo.age} months old, ${childInfo.gender}
TOTAL ATTEMPTS: ${totalAttempts}

ASSESSMENT HISTORY:
`;

  attemptGroups.forEach(attempt => {
    prompt += `\nAttempt ${attempt.attemptNumber} (${new Date(attempt.date).toLocaleDateString()}):\n`;
    attempt.assessments.forEach(assessment => {
      prompt += `  - ${assessment.questionnaireName}: Score ${assessment.score}, Risk Level: ${assessment.risk}\n`;
    });
  });

  prompt += `\nPlease analyze:
1. Overall trajectory of scores and risk levels across attempts
2. Key observations about changes in specific areas
3. Improvement areas (positive changes)
4. Areas of concern (worsening or persistent high risk)
5. Clinical recommendations based on trends
6. Suggested next steps

Provide detailed, evidence-based analysis focusing on developmental progress.`;

  return prompt;
}

/**
 * Parse LLM progress response
 */
function parseProgressResponse(text, progressData) {
  return {
    overallSummary: text.substring(0, 500),
    keyObservations: extractListItems(text, 'observations'),
    trendAnalysis: text,
    improvementAreas: extractListItems(text, 'improvement'),
    concernAreas: extractListItems(text, 'concern'),
    recommendations: extractListItems(text, 'recommendations'),
    nextSteps: extractListItems(text, 'next steps'),
    generatedBy: 'Ollama AI',
    generatedAt: new Date()
  };
}

/**
 * Rule-based progress analysis (fallback)
 */
async function ruleBasedProgressAnalysis(progressData) {
  const { childInfo, totalAttempts, attemptGroups } = progressData;
  
  // Calculate trends
  const trends = {};
  attemptGroups.forEach(attempt => {
    attempt.assessments.forEach(assessment => {
      if (!trends[assessment.questionnaireName]) {
        trends[assessment.questionnaireName] = [];
      }
      trends[assessment.questionnaireName].push({
        attempt: attempt.attemptNumber,
        score: assessment.score,
        risk: assessment.risk
      });
    });
  });
  
  // Analyze each questionnaire's trend
  const improvements = [];
  const concerns = [];
  const observations = [];
  
  Object.entries(trends).forEach(([name, history]) => {
    if (history.length < 2) return;
    
    const first = history[0];
    const last = history[history.length - 1];
    const scoreChange = last.score - first.score;
    
    if (scoreChange < 0) {
      improvements.push(`${name}: Score improved from ${first.score} to ${last.score} (${Math.abs(scoreChange)} point decrease)`);
    } else if (scoreChange > 0) {
      concerns.push(`${name}: Score increased from ${first.score} to ${last.score} (+${scoreChange} points)`);
    }
    
    if (first.risk !== last.risk) {
      const direction = getRiskDirection(first.risk, last.risk);
      observations.push(`${name}: Risk level changed from ${first.risk} to ${last.risk} (${direction})`);
    }
  });
  
  // Generate overall summary
  const avgFirstScore = attemptGroups[0].assessments.reduce((sum, a) => sum + a.score, 0) / attemptGroups[0].assessments.length;
  const avgLastScore = attemptGroups[attemptGroups.length - 1].assessments.reduce((sum, a) => sum + a.score, 0) / attemptGroups[attemptGroups.length - 1].assessments.length;
  const overallChange = avgLastScore - avgFirstScore;
  
  let overallSummary = `Progress analysis over ${totalAttempts} assessment attempts for ${childInfo.name}. `;
  
  if (overallChange < -2) {
    overallSummary += `Overall scores show significant improvement (average decrease of ${Math.abs(overallChange).toFixed(1)} points). `;
  } else if (overallChange > 2) {
    overallSummary += `Overall scores show increase (average increase of ${overallChange.toFixed(1)} points), requiring attention. `;
  } else {
    overallSummary += `Overall scores remain relatively stable across attempts. `;
  }
  
  return {
    overallSummary,
    keyObservations: observations.length > 0 ? observations : ['Multiple assessment attempts completed'],
    trendAnalysis: overallChange < 0 
      ? 'Assessment scores show a positive trend with decreasing risk indicators over time.'
      : overallChange > 0 
        ? 'Assessment scores show increasing trend. Close monitoring recommended.'
        : 'Assessment scores remain consistent across attempts.',
    improvementAreas: improvements.length > 0 ? improvements : ['Continue current interventions and monitoring'],
    concernAreas: concerns.length > 0 ? concerns : ['No significant areas of increasing concern identified'],
    recommendations: generateProgressRecommendations(overallChange, improvements, concerns),
    nextSteps: [
      'Continue regular screening assessments',
      'Monitor developmental milestones',
      'Consult with pediatric specialist for comprehensive evaluation',
      improvements.length > 0 ? 'Maintain current intervention strategies' : 'Consider additional support services'
    ],
    generatedBy: 'Rule-based Progress Analyzer',
    generatedAt: new Date()
  };
}

/**
 * Helper: Get risk direction
 */
function getRiskDirection(oldRisk, newRisk) {
  const levels = ['Low', 'Medium', 'Moderate', 'High'];
  const oldIndex = levels.indexOf(oldRisk);
  const newIndex = levels.indexOf(newRisk);
  
  if (newIndex < oldIndex) return 'improvement';
  if (newIndex > oldIndex) return 'escalation';
  return 'no change';
}

/**
 * Helper: Generate recommendations based on trends
 */
function generateProgressRecommendations(overallChange, improvements, concerns) {
  const recommendations = [];
  
  if (overallChange < -2) {
    recommendations.push('Continue current intervention strategies as they show positive results');
    recommendations.push('Maintain regular monitoring schedule');
  } else if (overallChange > 2) {
    recommendations.push('Consider intensifying intervention strategies');
    recommendations.push('Increase frequency of professional consultations');
    recommendations.push('Explore additional therapeutic options');
  } else {
    recommendations.push('Maintain current monitoring and intervention approach');
  }
  
  if (concerns.length > 0) {
    recommendations.push('Focus on areas showing increased scores');
    recommendations.push('Conduct detailed evaluation of concerning areas');
  }
  
  if (improvements.length > 0) {
    recommendations.push('Reinforce positive changes through continued engagement');
  }
  
  recommendations.push('Schedule comprehensive developmental assessment with specialist');
  
  return recommendations;
}

/**
 * Helper: Extract list items from text
 */
function extractListItems(text, keyword) {
  const items = [];
  const lines = text.split('\n');
  let capturing = false;
  
  lines.forEach(line => {
    if (line.toLowerCase().includes(keyword)) {
      capturing = true;
    } else if (capturing && (line.match(/^\d+\./) || line.match(/^[-•*]/))) {
      items.push(line.replace(/^(\d+\.|[-•*])\s*/, '').trim());
    } else if (capturing && line.trim() === '') {
      capturing = false;
    }
  });
  
  return items.length > 0 ? items : [`Analysis of ${keyword} in progress`];
}

module.exports = {
  analyzeAssessmentWithLocalLLM,
  generateMedicalReport,
  analyzeProgressWithLocalLLM,
  isOllamaAvailable
};
