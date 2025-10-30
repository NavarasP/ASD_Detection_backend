const axios = require('axios');

/**
 * LLM Service for analyzing assessment responses
 * Supports OpenAI GPT and Anthropic Claude
 */

/**
 * Generate LLM analysis for assessment answers
 * @param {Object} assessmentData - { type, answers, score, risk, childAge }
 * @returns {Object} { summary, recommendations, keyFindings }
 */
async function analyzeAssessment(assessmentData) {
  try {
    const { type, answers, score, risk, childAge } = assessmentData;

    // Build prompt for LLM
    const prompt = buildAssessmentPrompt(type, answers, score, risk, childAge);

    // Try OpenAI first, fall back to rule-based if no API key
    if (process.env.OPENAI_API_KEY) {
      return await generateWithOpenAI(prompt);
    } else if (process.env.ANTHROPIC_API_KEY) {
      return await generateWithAnthropic(prompt);
    } else {
      // Fallback to rule-based analysis
      console.warn('[LLM] No API key found, using rule-based analysis');
      return generateRuleBasedAnalysis(assessmentData);
    }
  } catch (error) {
    console.error('[LLM] Analysis error:', error.message);
    // Fallback to rule-based on error
    return generateRuleBasedAnalysis(assessmentData);
  }
}

/**
 * Build assessment analysis prompt
 */
function buildAssessmentPrompt(type, answers, score, risk, childAge) {
  const ageText = childAge ? `Child age: ${childAge} months` : 'Child age not specified';
  
  const answersText = Object.entries(answers)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');

  return `You are a pediatric specialist assistant analyzing an autism screening assessment.

Assessment Type: ${type}
${ageText}
Risk Level: ${risk}
Score: ${score || 'N/A'}

Assessment Responses:
${answersText}

Please provide a detailed analysis including:
1. A clinical summary of the assessment results (2-3 paragraphs)
2. Key findings and areas of concern (bullet points)
3. Recommendations for the caretaker and doctor (specific, actionable steps)

Focus on:
- Social communication patterns
- Repetitive behaviors
- Developmental milestones
- Sensory processing indicators

Format your response as JSON:
{
  "summary": "Clinical summary here...",
  "keyFindings": ["Finding 1", "Finding 2", "Finding 3"],
  "recommendations": "Detailed recommendations here..."
}`;
}

/**
 * Generate analysis using OpenAI API
 */
async function generateWithOpenAI(prompt) {
  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a clinical assistant specializing in autism spectrum disorder assessment analysis. Provide evidence-based, compassionate guidance.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: "json_object" }
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const content = response.data.choices[0].message.content;
  const parsed = JSON.parse(content);
  
  return {
    summary: parsed.summary || '',
    keyFindings: parsed.keyFindings || [],
    recommendations: parsed.recommendations || ''
  };
}

/**
 * Generate analysis using Anthropic Claude API
 */
async function generateWithAnthropic(prompt) {
  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
      max_tokens: 1500,
      temperature: 0.7,
      messages: [
        {
          role: 'user',
          content: prompt + '\n\nRespond only with valid JSON, no markdown.'
        }
      ]
    },
    {
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    }
  );

  const content = response.data.content[0].text;
  const parsed = JSON.parse(content);
  
  return {
    summary: parsed.summary || '',
    keyFindings: parsed.keyFindings || [],
    recommendations: parsed.recommendations || ''
  };
}

/**
 * Rule-based analysis fallback (when no LLM API available)
 */
function generateRuleBasedAnalysis(assessmentData) {
  const { type, risk, score, answers } = assessmentData;
  
  let summary = '';
  let keyFindings = [];
  let recommendations = '';

  // Generate summary based on risk level
  if (risk === 'High') {
    summary = `This ${type} assessment indicates a HIGH risk level with a score of ${score || 'N/A'}. Multiple indicators suggest the child may be experiencing developmental differences consistent with autism spectrum characteristics. The responses show patterns that warrant immediate professional evaluation. It's important to note that this is a screening tool, not a diagnostic instrument, and a comprehensive clinical assessment is strongly recommended.`;
    
    keyFindings = [
      'Multiple developmental indicators present across domains',
      'Significant concerns in social communication patterns',
      'Notable repetitive or restrictive behaviors observed',
      'Professional evaluation urgently recommended'
    ];
    
    recommendations = `Immediate next steps: 1) Schedule an appointment with a developmental pediatrician or child psychologist specializing in autism spectrum disorders within the next 2-4 weeks. 2) Document specific behaviors and concerns with timestamps and contexts. 3) Contact early intervention services in your area for evaluation. 4) Gather developmental history and medical records. 5) Consider joining parent support groups for guidance. Early intervention significantly improves outcomes, so prompt action is crucial.`;
  } else if (risk === 'Medium') {
    summary = `This ${type} assessment indicates a MEDIUM risk level with a score of ${score || 'N/A'}. Some developmental indicators are present that suggest monitoring and follow-up are needed. While not all criteria for high concern are met, the patterns observed warrant professional consultation to rule out or address any developmental differences. Continued observation and a follow-up assessment in 3-6 months would be prudent.`;
    
    keyFindings = [
      'Some developmental indicators requiring attention',
      'Mixed patterns in social-communication behaviors',
      'Follow-up assessment recommended',
      'Monitoring of developmental progress needed'
    ];
    
    recommendations = `Recommended actions: 1) Schedule a consultation with your pediatrician to discuss these findings within 4-6 weeks. 2) Keep a detailed log of social interactions, play patterns, and communication attempts. 3) Consider a formal developmental screening with a specialist. 4) Implement structured social play activities and track progress. 5) Re-assess in 3-6 months or sooner if concerns increase. Early monitoring allows for timely intervention if needed.`;
  } else {
    summary = `This ${type} assessment indicates a LOW risk level with a score of ${score || 'N/A'}. The responses show typical developmental patterns with no significant indicators of autism spectrum characteristics at this time. However, development is dynamic and ongoing monitoring is always recommended. Continue to observe your child's developmental progress and consult your pediatrician if new concerns arise.`;
    
    keyFindings = [
      'Developmental patterns within typical range',
      'No significant autism spectrum indicators at this time',
      'Routine developmental monitoring recommended',
      'Continue with regular pediatric check-ups'
    ];
    
    recommendations = `General recommendations: 1) Continue routine pediatric well-child visits and developmental screenings. 2) Engage in age-appropriate social and language-rich activities. 3) Be aware of developmental milestones and contact your pediatrician if you notice any regression or new concerns. 4) Consider re-screening if concerns emerge or at key developmental ages (18, 24, 36 months). 5) Trust your instincts - if you have ongoing concerns despite low screening scores, discuss them with your healthcare provider.`;
  }

  // Add answer-specific findings
  const highRiskAnswers = Object.entries(answers).filter(([key, value]) => {
    return typeof value === 'number' && value >= 2;
  });

  if (highRiskAnswers.length > 0) {
    keyFindings.push(`${highRiskAnswers.length} responses indicate areas requiring attention`);
  }

  return {
    summary,
    keyFindings,
    recommendations
  };
}

module.exports = {
  analyzeAssessment
};
