import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { apiRouter } from './routes';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// API routes
app.use('/api', apiRouter);

// Health check endpoints
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/ready', (_req, res) => {
  res.json({
    status: 'ready',
    timestamp: new Date().toISOString()
  });
});

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 AMP Email Generation API Platform`);
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`📚 API Version: ${process.env.API_VERSION}`);
});

export default app;

