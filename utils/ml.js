/**
 * evaluateRisk(answers)
 * - answers: object like { q1: 2, q2: 0, q3: 3, ... }
 * Returns { riskLevel: 'Low'|'Medium'|'High', probability: 0..1, explanation: {...} }
 *
 * This is a lightweight heuristic model. Replace this function with a call to:
 *  - a trained TF.js model, or
 *  - an internal Python microservice that returns predictions
 *  - or an exported ONNX / TF model
 */

function normalizeVal(v, min=0, max=3) {
  if (typeof v !== 'number') return 0;
  if (v < min) return min;
  if (v > max) return max;
  return (v - min) / (max - min);
}

function evaluateRisk(answers) {
  // example domain groups and weights (tune these)
  // keys should match your frontend question names
  const weights = {
    // social/communication
    q_social_eye_contact: 1.5,
    q_social_response_name: 1.4,
    q_social_pointing: 1.2,

    // language
    q_lang_babbling: 1.2,
    q_lang_words_by_age: 1.3,

    // repetitive behaviours
    q_repetitive_stereotype: 1.4,
    q_repetitive_resistance_change: 1.3,

    // motor / sensory
    q_motor_delay: 1.1,
    q_sensory_unusual_interest: 1.0
  };

  // If frontend uses different keys, adjust accordingly or map them before calling.

  // compute weighted score
  let totalWeight = 0;
  let weightedSum = 0;
  let breakdown = {};

  for (const [k, w] of Object.entries(weights)) {
    const raw = answers[k];
    const norm = normalizeVal(Number(raw), 0, 3); // assume scale 0..3
    totalWeight += w;
    weightedSum += norm * w;
    breakdown[k] = { raw: raw === undefined ? null : raw, norm: Number(norm.toFixed(3)), weight: w, contrib: Number((norm*w).toFixed(3)) };
  }

  // guard: if no known keys present, compute generic fallback: average of all numeric answers
  if (totalWeight === 0) {
    // fallback: average numeric values in answers
    const nums = Object.values(answers).filter(v => typeof v === 'number');
    const avg = nums.length ? nums.reduce((a,b)=>a+b,0)/nums.length : 0;
    // assume avg is already 0..3 scale
    const prob = Math.min(1, Math.max(0, avg/3));
    const riskLevel = prob < 0.33 ? 'Low' : (prob < 0.66 ? 'Medium' : 'High');
    return { riskLevel, probability: Number(prob.toFixed(3)), explanation: { fallbackAvg: avg, breakdown: {} } };
  }

  // normalized probability in [0,1]
  const probability = Math.max(0, Math.min(1, weightedSum / totalWeight));

  let riskLevel = 'Low';
  if (probability >= 0.66) riskLevel = 'High';
  else if (probability >= 0.33) riskLevel = 'Medium';

  // human readable recommendation
  let recommendation = '';
  if (riskLevel === 'Low') recommendation = 'No immediate concerns based on this preliminary screening. Continue monitoring and consult a pediatric specialist if you have concerns.';
  else if (riskLevel === 'Medium') recommendation = 'Some indicators present. Consider follow-up assessment and monitoring; consult a pediatrician or ASD specialist.';
  else recommendation = 'Several indicators are present. Please seek professional evaluation by a clinical specialist for formal diagnosis.';

  return {
    riskLevel,
    probability: Number(probability.toFixed(3)),
    explanation: { breakdown, totalWeight: Number(totalWeight.toFixed(3)), weightedSum: Number(weightedSum.toFixed(3)), recommendation }
  };
}

module.exports = { evaluateRisk };
