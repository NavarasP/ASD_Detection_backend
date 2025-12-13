const mongoose = require('mongoose');

const gameSessionSchema = new mongoose.Schema(
  {
    childId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Child',
      required: true,
    },
    gameType: {
      type: String,
      enum: ['memory', 'eye-tracking', 'hand-coordination', 'simon-says'],
      default: 'memory',
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'easy',
    },
    score: {
      type: Number,
      default: 0,
    },
    accuracy: {
      type: Number, // percentage (0-100)
      default: 0,
    },
    reactionTime: {
      type: Number, // milliseconds
      default: 0,
    },
    totalMatches: {
      type: Number,
      default: 0,
    },
    correctMatches: {
      type: Number,
      default: 0,
    },
    totalTime: {
      type: Number, // seconds
      default: 0,
    },
    moves: {
      type: Number,
      default: 0,
    },
    errorCount: {
      type: Number,
      default: 0,
    },
    consistency: {
      type: Number, // 0-100, lower variance = higher consistency
      default: 0,
    },
    gameDetails: {
      cardsFlipped: [
        {
          cardIndex: Number,
          timestamp: Date,
          correct: Boolean,
        },
      ],
      matchedPairs: {
        type: Number,
        default: 0,
      },
      averageTimePerMove: Number,
      fastestMove: Number,
      slowestMove: Number,
    },
    status: {
      type: String,
      enum: ['in-progress', 'completed', 'abandoned'],
      default: 'in-progress',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('GameSession', gameSessionSchema);
