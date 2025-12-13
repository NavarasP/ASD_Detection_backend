const express = require('express');
const GameSession = require('../models/Game');
const Assessment = require('../models/Assessment');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Start a new hand-eye coordination game session
router.post('/api/games/hand-eye/start', requireAuth, async (req, res) => {
  try {
    const { childId, difficulty = 'easy' } = req.body;

    const gameSession = new GameSession({
      childId,
      gameType: 'hand-coordination',
      difficulty,
      status: 'in-progress',
      totalMatches: difficulty === 'easy' ? 10 : difficulty === 'medium' ? 15 : 20,
      gameDetails: {
        cardsFlipped: [],
        matchedPairs: 0,
      },
    });

    await gameSession.save();
    res.json({
      success: true,
      sessionId: gameSession._id,
      difficulty: gameSession.difficulty,
      totalTargets: gameSession.totalMatches,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Record a target hit
router.post('/api/games/hand-eye/hit', requireAuth, async (req, res) => {
  try {
    const { sessionId, reactionTime, accuracy, hitCenter } = req.body;

    const session = await GameSession.findById(sessionId);
    if (!session) return res.status(404).json({ success: false, error: 'Session not found' });

    session.gameDetails.cardsFlipped.push({
      cardIndex: session.gameDetails.cardsFlipped.length,
      timestamp: new Date(),
      correct: hitCenter,
    });

    if (hitCenter) {
      session.correctMatches++;
    } else {
      session.errorCount++;
    }

    session.moves++;

    // Update reaction times
    const times = session.gameDetails.cardsFlipped.map((f, idx) => {
      if (idx === 0) return 0;
      return f.timestamp - session.gameDetails.cardsFlipped[idx - 1].timestamp;
    }).filter(t => t > 0);

    if (times.length > 0) {
      session.gameDetails.averageTimePerMove = times.reduce((a, b) => a + b) / times.length;
      session.gameDetails.fastestMove = Math.min(...times);
      session.gameDetails.slowestMove = Math.max(...times);
      session.reactionTime = Math.round(session.gameDetails.averageTimePerMove);
    }

    session.accuracy = Math.round((session.correctMatches / session.moves) * 100);

    await session.save();
    res.json({ success: true, accuracy: session.accuracy, moves: session.moves });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Complete game session
router.post('/api/games/hand-eye/complete', requireAuth, async (req, res) => {
  try {
    const { sessionId, totalTime, averageAccuracy } = req.body;

    const session = await GameSession.findById(sessionId);
    if (!session) return res.status(404).json({ success: false, error: 'Session not found' });

    session.status = 'completed';
    session.totalTime = totalTime;

    // Calculate final score (0-100)
    const accuracyScore = averageAccuracy || session.accuracy || 0;
    const speedScore = Math.max(0, 100 - Math.round(session.reactionTime / 20));
    const completionBonus = Math.round((session.correctMatches / session.totalMatches) * 100);

    session.score = Math.round((accuracyScore + speedScore + completionBonus) / 3);

    // Calculate consistency
    if (session.gameDetails.cardsFlipped.length > 1) {
      const times = [];
      for (let i = 1; i < session.gameDetails.cardsFlipped.length; i++) {
        times.push(
          session.gameDetails.cardsFlipped[i].timestamp - session.gameDetails.cardsFlipped[i - 1].timestamp
        );
      }
      const mean = times.reduce((a, b) => a + b) / times.length;
      const variance = times.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / times.length;
      const stdDev = Math.sqrt(variance);
      session.consistency = Math.max(0, 100 - Math.round(stdDev / 10));
    }

    await session.save();

    res.json({
      success: true,
      score: session.score,
      accuracy: session.accuracy,
      totalTime: session.totalTime,
      consistency: session.consistency,
      reactionTime: session.reactionTime,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get game history
router.get('/api/games/hand-eye/history/:childId', requireAuth, async (req, res) => {
  try {
    const { childId } = req.params;
    const games = await GameSession.find({ childId, gameType: 'hand-coordination', status: 'completed' })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({ success: true, games });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get game stats
router.get('/api/games/hand-eye/stats/:childId', requireAuth, async (req, res) => {
  try {
    const { childId } = req.params;
    const games = await GameSession.find({ childId, gameType: 'hand-coordination', status: 'completed' });

    if (games.length === 0) {
      return res.json({
        success: true,
        stats: {
          averageScore: 0,
          averageAccuracy: 0,
          averageReactionTime: 0,
          totalGames: 0,
          bestScore: 0,
        },
      });
    }

    const stats = {
      averageScore: Math.round(games.reduce((sum, g) => sum + g.score, 0) / games.length),
      averageAccuracy: Math.round(games.reduce((sum, g) => sum + g.accuracy, 0) / games.length),
      averageReactionTime: Math.round(games.reduce((sum, g) => sum + g.reactionTime, 0) / games.length),
      averageConsistency: Math.round(games.reduce((sum, g) => sum + g.consistency, 0) / games.length),
      totalGames: games.length,
      bestScore: Math.max(...games.map((g) => g.score)),
      improvementTrend: calculateTrend(games),
    };

    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

function calculateTrend(games) {
  if (games.length < 2) return 0;
  const recent = games.slice(0, Math.min(5, games.length));
  const older = games.slice(Math.min(5, games.length), Math.min(10, games.length));

  if (older.length === 0) return 0;

  const recentAvg = recent.reduce((sum, g) => sum + g.score, 0) / recent.length;
  const olderAvg = older.reduce((sum, g) => sum + g.score, 0) / older.length;

  return Math.round(((recentAvg - olderAvg) / olderAvg) * 100);
}

module.exports = router;
