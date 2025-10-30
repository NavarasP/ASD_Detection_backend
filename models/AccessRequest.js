const mongoose = require('mongoose');

const AccessRequestSchema = new mongoose.Schema({
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  childId: { type: mongoose.Schema.Types.ObjectId, ref: 'Child', required: true },
  caretakerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'denied'], 
    default: 'pending' 
  },
  message: { type: String }, // Optional message from doctor explaining why they need access
  respondedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

// Index for efficient queries
AccessRequestSchema.index({ doctorId: 1, childId: 1 });
AccessRequestSchema.index({ caretakerId: 1, status: 1 });

module.exports = mongoose.model('AccessRequest', AccessRequestSchema);
