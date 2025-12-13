const mongoose = require('mongoose');

const AssessmentSchema = new mongoose.Schema({
  childId: { type: mongoose.Schema.Types.ObjectId, ref: 'Child', required: true },
  caretakerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  questionnaireId: { type: mongoose.Schema.Types.ObjectId, ref: 'Questionnaire', required: true },
  // Keep type for backward compatibility with existing assessments
  type: { type: String, default: 'MCHAT' },
  answers: { type: Object, required: true },
  score: { type: Number },
  risk: { type: String, enum: ['Low', 'Medium', 'Moderate', 'High'] },
  llmAnalysis: { 
    summary: { type: String }, // LLM-generated summary
    recommendations: { type: String }, // LLM recommendations
    keyFindings: [{ type: String }], // Array of key findings
    generatedAt: { type: Date }
  },
  // Progress tracking fields
  progress: {
    completedQuestions: { type: Number, default: 0 }, // e.g., 18 questions answered
    totalQuestions: { type: Number, default: 0 }, // e.g., 20 total questions
    lastAnsweredAt: { type: Date }, // Timestamp of last answer
    status: { type: String, enum: ['draft', 'in-progress', 'completed'], default: 'completed' } // Assessment status
  },
  reviewedByDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Auto-update updatedAt on save
AssessmentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Assessment', AssessmentSchema);
