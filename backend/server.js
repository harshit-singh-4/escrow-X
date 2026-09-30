import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import mongoose from 'mongoose';
import connectDB from './config/db.js';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import milestoneRoutes from './routes/milestoneRoutes.js';
import disputeRoutes from './routes/disputeRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import freelancerRoutes from './routes/freelancerRoutes.js';
import proposalRoutes from './routes/proposalRoutes.js';
import invitationRoutes from './routes/invitationRoutes.js';
import { errorHandler } from './middleware/errorMiddleware.js';

dotenv.config();

const app = express();
const PORT = process.env.BACKEND_PORT || 5000;

// Connect to MongoDB
connectDB().then((connected) => {
  if (connected) {
    console.log('MongoDB connected successfully.');
  } else {
    console.log('MongoDB server not running at mongodb://localhost:27017/escrowx.');
    console.log('Backend server running on port ' + PORT + ' ready to accept connections.');
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/api/health', (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  res.json({
    status: 'online',
    platform: 'EscrowX – Decentralized Freelancer Escrow System',
    port: PORT,
    database: isConnected ? 'MongoDB (Connected)' : 'MongoDB (Disconnected)',
    connected: isConnected
  });
});

// Check MongoDB connection middleware for API routes
app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next();
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      error: 'DATABASE_UNAVAILABLE',
      message: 'MongoDB is currently unavailable. Please ensure MongoDB is running at ' + (process.env.MONGODB_URI || 'mongodb://localhost:27017/escrowx')
    });
  }
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/milestones', milestoneRoutes);
app.use('/api/disputes', disputeRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/freelancers', freelancerRoutes);
app.use('/api/proposals', proposalRoutes);
app.use('/api/invitations', invitationRoutes);

// Error Middleware
app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`EscrowX Backend running on port ${PORT}`);
  console.log(`MongoDB URI: ${process.env.MONGODB_URI }`);
  console.log(`===============================================`);
});

export default app;
