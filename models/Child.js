const mongoose = require('mongoose');

const ChildSchema = new mongoose.Schema({
  caretakerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  dob: { type: Date, required: true },
  gender: { type: String, enum: ['Male', 'Female', 'Other'] },
  notes: { type: String },
  medicalHistory: { type: String }, // Additional medical background
  authorizedDoctors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Doctors with approved access
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Child', ChildSchema);
