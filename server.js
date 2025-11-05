require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const { initChatServer } = require('./chatServer');

const authRoutes = require('./routes/auth');
const responseRoutes = require('./routes/response');
const adminRoutes = require('./routes/admin');
const childrenRoutes = require('./routes/children');
const assessmentRoutes = require('./routes/assessments');
const mediaRoutes = require('./routes/media');
const reportRoutes = require('./routes/reports-enhanced');
const dashboardRoutes = require('./routes/dashboard');
const chatRoutes = require('./routes/chat');
const searchRoutes = require('./routes/search');
const accessRoutes = require('./routes/access');
const questionnaireRoutes = require('./routes/questionnaires');
const llmRoutes = require('./routes/llm');

const app = express();

// Security + Middleware
app.use(helmet());
app.use(express.json());

// CORS Setup
const allowedOrigins = [
  process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
  'https://predictasd.vercel.app',
];
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}));

// MongoDB Connection with timeout
const connectMongoDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
    });
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    console.log('⚠️  Server will continue running but database operations will fail');
    console.log('💡 To fix: Add your IP to MongoDB Atlas whitelist or use local MongoDB');
  }
};

connectMongoDB();

// Health check
app.get('/', (req, res) => res.send({ status: 'ok', service: 'predict-asd-backend' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/responses', responseRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/children', childrenRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/access', accessRoutes);
app.use('/api/questionnaires', questionnaireRoutes);
app.use('/api/llm', llmRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('🔥 Error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// HTTP + Socket Server
const PORT = process.env.PORT || 8002;
const server = http.createServer(app);
initChatServer(server);

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`💬 WebSocket chat active on ws://localhost:${PORT}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});
