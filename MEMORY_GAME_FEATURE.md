# Memory Game Feature Documentation

## Overview
The Memory Game is an interactive cognitive assessment tool designed to track and evaluate working memory, attention span, and processing speed in children. The game automatically converts performance metrics into standardized assessment scores.

## Features

### Game Mechanics
- **Difficulty Levels**: Easy (8 cards), Medium (12 cards), Hard (16 cards)
- **Card Matching**: Flip cards to find matching pairs
- **Real-time Tracking**: Monitors accuracy, reaction time, and consistency
- **Auto-Save**: All game sessions automatically saved to database

### Performance Metrics

#### Primary Metrics
1. **Score (0-100)**: Composite score based on:
   - Accuracy: Percentage of correct matches
   - Speed: Efficiency in completing the game
   - Efficiency: Number of moves vs optimal moves

2. **Accuracy**: Percentage of correct card flips
   - Formula: (Correct Flips / Total Flips) × 100
   - Decreases by 5% for each incorrect match during gameplay

3. **Reaction Time**: Average time between card flips
   - Measured in milliseconds
   - Includes fastest and slowest move tracking

4. **Consistency**: Measure of variance in reaction times
   - Formula: 100 - (Standard Deviation / 10)
   - Higher values indicate more consistent performance

#### Tracking Data
- Total moves made
- Number of correctly matched pairs
- Error count
- Time per move (min, max, average)
- Detailed flip history with timestamps

## Backend API

### Models

#### GameSession Schema
```javascript
{
  childId: ObjectId,           // Reference to child
  gameType: String,            // 'memory', 'eye-tracking', etc.
  difficulty: String,          // 'easy', 'medium', 'hard'
  score: Number,              // Final score 0-100
  accuracy: Number,           // Accuracy percentage
  reactionTime: Number,       // Average reaction time in ms
  totalMatches: Number,       // Total pairs in game
  correctMatches: Number,     // Correctly matched pairs
  totalTime: Number,          // Total game duration in seconds
  moves: Number,              // Total flips made
  errorCount: Number,         // Wrong matches
  consistency: Number,        // Consistency score 0-100
  gameDetails: {
    cardsFlipped: [{
      cardIndex: Number,
      timestamp: Date,
      correct: Boolean
    }],
    matchedPairs: Number,
    averageTimePerMove: Number,
    fastestMove: Number,
    slowestMove: Number
  },
  status: String,             // 'in-progress', 'completed', 'abandoned'
  createdAt: Date,
  updatedAt: Date
}
```

### API Endpoints

#### 1. Start Game Session
```
POST /api/games/memory/start
Content-Type: application/json
Authorization: Bearer <token>

{
  "childId": "123456789",
  "difficulty": "easy"  // 'easy', 'medium', or 'hard'
}

Response:
{
  "success": true,
  "sessionId": "abc123def456",
  "difficulty": "easy",
  "totalCards": 8
}
```

#### 2. Record Card Flip
```
POST /api/games/memory/flip
Content-Type: application/json
Authorization: Bearer <token>

{
  "sessionId": "abc123def456",
  "cardIndex": 0,
  "isCorrect": true,
  "reactionTime": 1200
}

Response:
{
  "success": true,
  "accuracy": 85,
  "moves": 3
}
```

#### 3. Complete Game
```
POST /api/games/memory/complete
Content-Type: application/json
Authorization: Bearer <token>

{
  "sessionId": "abc123def456",
  "totalTime": 45
}

Response:
{
  "success": true,
  "score": 78,
  "accuracy": 85,
  "totalTime": 45,
  "consistency": 82
}
```

#### 4. Get Game History
```
GET /api/games/memory/history/:childId
Authorization: Bearer <token>

Response:
{
  "success": true,
  "games": [
    {
      "_id": "abc123",
      "score": 78,
      "accuracy": 85,
      "totalTime": 45,
      "difficulty": "easy",
      "createdAt": "2024-12-13T10:30:00Z"
    }
  ]
}
```

#### 5. Get Game Statistics
```
GET /api/games/memory/stats/:childId
Authorization: Bearer <token>

Response:
{
  "success": true,
  "stats": {
    "averageScore": 75,
    "averageAccuracy": 82,
    "averageReactionTime": 1150,
    "averageConsistency": 78,
    "totalGames": 5,
    "bestScore": 88,
    "improvementTrend": 12  // percentage change from oldest to newest games
  }
}
```

## Frontend Components

### MemoryGame Component
**File**: `frontend/components/memory-game.tsx`

Interactive React component that renders the memory game interface.

#### Props
- `childId`: String - ID of the child playing the game

#### State
- `sessionId`: Current game session ID
- `difficulty`: Game difficulty level
- `cards`: Array of card objects
- `flipped`: Indices of currently flipped cards
- `matched`: Indices of matched card pairs
- `moves`: Total moves made
- `score`: Current score
- `gameStarted`: Game state flag
- `gameCompleted`: Completion state flag
- `stats`: Final game statistics
- `elapsedTime`: Elapsed time in seconds
- `accuracy`: Current accuracy percentage

#### Features
- Difficulty selection UI
- Real-time card flipping animation
- Progress bar showing pairs found
- Live statistics display
- Game completion summary
- Auto-save integration

### GameLauncher Component
**File**: `frontend/components/game-launcher.tsx`

Dashboard component for launching games and viewing statistics.

#### Props
- `childId`: String - ID of the child

#### Features
- Game selection cards
- Real-time stats display
- Best score tracking
- Improvement trend visualization
- Link to game pages

## Integration Points

### Child Dashboard
Add `<GameLauncher childId={childId} />` to the child profile page to enable game launching.

### Assessment Generation
Game scores automatically create/update Assessment documents with:
```javascript
{
  gameAssessments: [{
    gameType: 'memory',
    gameSessionId: '<session-id>',
    score: 78,
    accuracy: 85,
    reactionTime: 1150,
    difficulty: 'easy',
    completedAt: Date
  }]
}
```

## Assessment Interpretation

### Score Ranges
- **85-100**: Excellent memory and processing speed
- **70-84**: Good cognitive function
- **50-69**: Average with room for improvement
- **Below 50**: May indicate attention or memory concerns

### Consistency Analysis
- **80-100**: Highly consistent performance
- **60-79**: Generally consistent with some variance
- **Below 60**: Inconsistent performance may indicate fatigue or attention issues

### Improvement Tracking
- Positive trend (>0%): Child is improving over time
- Negative trend (<0%): Performance declining, may need intervention
- Flat trend (~0%): Stable performance level

## Usage Flow

### For Caretakers
1. Navigate to child's profile
2. Click "Play Now" on Memory Game card
3. Select difficulty level
4. Child plays game
5. View results and statistics
6. Track progress over multiple sessions

### For Doctors
1. View child's game assessment history in dashboard
2. Analyze performance trends
3. Compare with baseline assessments
4. Use data to inform clinical evaluation

## Technical Implementation

### Frontend Flow
```
1. User selects difficulty
2. API call to /api/games/memory/start
3. Game initializes with shuffled cards
4. User clicks cards
5. On card flip: validate match, call /api/games/memory/flip
6. Update local state and UI
7. On game completion: call /api/games/memory/complete
8. Display results and stats
```

### Backend Flow
```
1. Validate auth and create GameSession
2. Record each flip with timestamp
3. Calculate metrics (accuracy, reaction time, etc.)
4. On completion: calculate final score
5. Save to database
6. Create/update Assessment document
7. Return results to frontend
```

## Data Persistence

### localStorage (Frontend)
- Current game state (for recovery if disconnected)
- Draft game data

### MongoDB (Backend)
- Complete game session data
- All performance metrics
- Assessment records
- Historical data for trend analysis

## Future Enhancements

1. **Additional Game Types**
   - Eye tracking games
   - Hand-eye coordination games
   - Simon Says (sequence memory)

2. **Advanced Analytics**
   - Detailed performance comparisons
   - Predictive improvement modeling
   - Benchmark comparisons with age groups

3. **Gamification**
   - Leaderboards
   - Achievement badges
   - Difficulty progression

4. **Customization**
   - Custom card images/themes
   - Adjustable difficulty scaling
   - Time limits

## Troubleshooting

### Game Not Starting
- Verify child ID is valid
- Check authentication token
- Ensure MongoDB connection is active

### Scores Not Saving
- Check network connectivity
- Verify backend API is responding
- Check browser console for errors

### Inaccurate Metrics
- Ensure accurate timestamp recording
- Verify no clock skew between client/server
- Check browser performance (lag can affect reaction times)

## Performance Optimization

- Card grid size optimized for mobile and desktop
- Animations use CSS transforms for smooth performance
- Real-time calculations optimized for large datasets
- API calls batched where possible
