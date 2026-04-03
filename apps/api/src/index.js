import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { initSocket } from './services/socket.js';
import { initRedis } from './services/redis.js';

// Validate required environment variables at startup
function validateEnvironment() {
  const required = [
    'JWT_SECRET',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'SUPABASE_ANON_KEY'
  ];
  
  const missing = required.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(v => console.error(`   - ${v}`));
    console.error('\nPlease set these variables in your .env file or Coolify environment.');
    process.exit(1);
  }
  
  console.log('✅ Environment variables validated');
}

validateEnvironment();

// Import routes
import authRoutes from './routes/auth.js';
import companyRoutes from './routes/companies.js';
import userRoutes from './routes/users.js';
import transferRoutes from './routes/transfers.js';
import outcomeRoutes from './routes/outcomes.js';
import dispositionRoutes from './routes/dispositions.js';
import callbackRoutes from './routes/callbacks.js';
import numberRoutes from './routes/numbers.js';
import searchRoutes from './routes/search.js';
import auditRoutes from './routes/audit.js';

const app = express();
const httpServer = createServer(app);

// Initialize Socket.io
initSocket(httpServer);

// Initialize Redis
initRedis();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/companies', companyRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/transfers', transferRoutes);
app.use('/api/v1/outcomes', outcomeRoutes);
app.use('/api/v1/dispositions', dispositionRoutes);
app.use('/api/v1/callbacks', callbackRoutes);
app.use('/api/v1/numbers', numberRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/audit', auditRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.name === 'ZodError') {
    return res.status(422).json({
      error: 'Validation error',
      details: err.errors,
    });
  }
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

const PORT = process.env.PORT || 4000;

httpServer.listen(PORT, () => {
  console.log(`🚀 BizTrixVenture API running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
