const mongoose = require('mongoose');

const ResponseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  childName: { type: String, required: false },
  childAgeMonths: { type: Number, required: false }, // store age in months
  answers: { type: Object, required: true }, // store questionnaire answers as a map
  meta: { type: Object }, // device, locale, language, timestamps
  prediction: {
    riskLevel: { type: String }, // Low, Medium, High
    probability: { type: Number }, // 0..1
    explanation: { type: Object } // optional breakdown / weights
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Response', ResponseSchema);
