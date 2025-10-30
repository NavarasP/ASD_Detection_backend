const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  order: { type: Number, required: true }
}, { _id: false });

const ScoringRuleSchema = new mongoose.Schema({
  minScore: { type: Number, required: true },
  maxScore: { type: Number },
  riskLevel: { type: String, enum: ['Low', 'Medium', 'Moderate', 'High'], required: true },
  description: { type: String }
}, { _id: false });

const QuestionnaireSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g., "M-CHAT"
  fullName: { type: String, required: true }, // e.g., "Modified Checklist for Autism in Toddlers"
  description: { type: String }, // Brief description
  questions: [QuestionSchema], // Array of questions
  answerOptions: [{ type: String }], // e.g., ["yes", "no", "sometimes"]
  scoringRules: [ScoringRuleSchema], // Scoring guidelines
  scoringInfo: { type: String }, // Human-readable scoring guide
  duration: { type: String }, // e.g., "5-10 minutes"
  ageRange: { type: String }, // e.g., "16-30 months"
  isActive: { type: Boolean, default: true }, // Only active questionnaires shown to users
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
QuestionnaireSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Questionnaire', QuestionnaireSchema);
