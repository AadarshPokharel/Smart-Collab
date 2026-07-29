require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');
const { getAllowedOrigins, getRequiredEnv } = require('./config/env');
const { authMiddleware } = require('./middleware/auth');
const {
  getDashboardData,
  getDashboardStats,
  getDashboardActivity,
  getDashboardNotifications,
} = require('./controllers/dashboardController');

const app = express();
const allowedOrigins = getAllowedOrigins();

// Middleware
app.use(morgan('combined'));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/activities', require('./routes/activities'));

app.get('/api/dashboard', authMiddleware, getDashboardData);
app.get('/api/dashboard/stats', authMiddleware, getDashboardStats);
app.get('/api/activity', authMiddleware, getDashboardActivity);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// Server time endpoint (authoritative time source for clients)
app.get('/api/time', (req, res) => {
  const now = new Date();
  res.json({
    nowMs: now.getTime(),
    nowIso: now.toISOString(),
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const connectDatabase = async () => {
  const mongoUri = getRequiredEnv('MONGODB_URI');

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10000,
  });

  console.log('MongoDB connected');
};

const startServer = async () => {
  try {
    await connectDatabase();

    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, () => {
      console.log(`SmartCollab backend running on port ${PORT}`);
    });

    const shutdown = async (signal) => {
      console.log(`${signal} received, shutting down gracefully`);

      server.close(async () => {
        try {
          await mongoose.connection.close();
        } finally {
          process.exit(0);
        }
      });

      setTimeout(() => {
        process.exit(1);
      }, 10000).unref();
    };

    process.on('SIGINT', () => {
      shutdown('SIGINT');
    });

    process.on('SIGTERM', () => {
      shutdown('SIGTERM');
    });
  } catch (error) {
    console.error('Failed to start SmartCollab backend:', error.message);
    process.exit(1);
  }
};

startServer();
