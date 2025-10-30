const mongoose = require('mongoose');

const AssessmentSchema = new mongoose.Schema({
  childId: { type: mongoose.Schema.Types.ObjectId, ref: 'Child', required: true },
  caretakerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  questionnaireId: { type: mongoose.Schema.Types.ObjectId, ref: 'Questionnaire', required: true },
  // Keep type for backward compatibility with existing assessments
  type: { type: String, enum: ['MCHAT', 'SCQ', 'TABC'], default: 'MCHAT' },
  answers: { type: Object, required: true },
  score: { type: Number },
  risk: { type: String, enum: ['Low', 'Medium', 'Moderate', 'High'] },
  llmAnalysis: { 
    summary: { type: String }, // LLM-generated summary
    recommendations: { type: String }, // LLM recommendations
    keyFindings: [{ type: String }], // Array of key findings
    generatedAt: { type: Date }
  },
  reviewedByDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Assessment', AssessmentSchema);
