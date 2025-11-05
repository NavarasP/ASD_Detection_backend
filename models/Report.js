const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  childId: { type: mongoose.Schema.Types.ObjectId, ref: 'Child', required: true },
  assessmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment' },
  text: { type: String },
  pdfUrl: { type: String },
  analysis: {
    summary: { type: String },
    keyFindings: [{ type: String }],
    recommendations: [{ type: String }],
    riskLevel: { type: String },
    confidenceScore: { type: Number },
    notes: { type: String },
    generatedBy: { type: String }
  },
  metadata: {
    generatedBy: { type: String },
    confidenceScore: { type: Number },
    riskLevel: { type: String }
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Report', ReportSchema);
