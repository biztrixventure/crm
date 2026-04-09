import 'dotenv/config';
import './startup-check.js'; // Run startup verification first
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { initSocket } from './services/socket.js';
import { initRedis } from './services/redis.js';
import { CONFIG } from './lib/config.js';

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
import planRoutes from './routes/plans.js';
import clientRoutes from './routes/clients.js';
import callbackRoutes from './routes/callbacks.js';
import numberRoutes from './routes/numbers.js';
import auditRoutes from './routes/audit.js';
import searchRoutes from './routes/search.js';
import closerManagerRoutes from './routes/closer-manager.js';
import operationsRoutes from './routes/operations.js';
import complianceRoutes from './routes/compliance.js';
import notificationRoutes from './routes/notifications.js';

const app = express();
const httpServer = createServer(app);

// Trust proxy - required for rate limiting behind reverse proxy (Coolify/Traefik)
app.set('trust proxy', 1);

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
  origin: CONFIG.CORS_ORIGIN,
  credentials: CONFIG.CORS_CREDENTIALS,
}));

// Compression middleware - reduces response size for CSV exports and large JSON
if (CONFIG.ENABLE_COMPRESSION) {
  app.use(compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    },
    threshold: 1024, // 1KB minimum size to compress
  }));
}

// Body parsing with size limits to prevent DOS attacks
app.use(express.json({ limit: CONFIG.REQUEST_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: CONFIG.REQUEST_BODY_LIMIT }));

// Request timeout middleware
app.use((req, res, next) => {
  req.setTimeout(CONFIG.REQUEST_TIMEOUT);
  res.setTimeout(CONFIG.REQUEST_TIMEOUT);
  next();
});

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
app.use('/api/v1/plans', planRoutes);
app.use('/api/v1/clients', clientRoutes);
app.use('/api/v1/callbacks', callbackRoutes);
app.use('/api/v1/numbers', numberRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/closer-manager', closerManagerRoutes);
app.use('/api/v1/operations', operationsRoutes);
app.use('/api/v1/compliance', complianceRoutes);
app.use('/api/v1/notifications', notificationRoutes);

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

// Better error handling for startup
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ BizTrixVenture API running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Routes registered: Auth, Companies, Users, Transfers, Outcomes, Dispositions, Plans, Clients, Callbacks, Numbers, Audit, Search, CloserManager, Operations, Compliance`);
}).on('error', (err) => {
  console.error('❌ Server startup error:', err);
  process.exit(1);
});

export default app;
