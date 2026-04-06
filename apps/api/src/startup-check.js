// Startup verification - runs before index.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🔍 Running startup verification...\n');

// 1. Check environment variables
console.log('✓ Checking environment variables...');
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'SUPABASE_ANON_KEY',
  'JWT_SECRET',
];

const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error('❌ Missing environment variables:', missingVars.join(', '));
  process.exit(1);
} else {
  console.log('   ✅ All required environment variables are set\n');
}

// 2. Check all route files exist
console.log('✓ Checking route files...');
const routeFiles = [
  'auth.js',
  'companies.js',
  'users.js',
  'transfers.js',
  'outcomes.js',
  'dispositions.js',
  'plans.js',
  'clients.js',
  'callbacks.js',
  'numbers.js',
  'audit.js',
  'search.js',
  'closer-manager.js',
  'operations.js',
  'compliance.js',
];

const routesDir = path.join(__dirname, 'routes');
const missingRoutes = routeFiles.filter(file => !fs.existsSync(path.join(routesDir, file)));

if (missingRoutes.length > 0) {
  console.error('❌ Missing route files:', missingRoutes.join(', '));
  process.exit(1);
} else {
  console.log(`   ✅ All ${routeFiles.length} route files found\n`);
}

// 3. Check services exist
console.log('✓ Checking service files...');
const serviceFiles = ['supabase.js', 'socket.js', 'redis.js', 'notification.js', 'audit.js'];
const servicesDir = path.join(__dirname, 'services');
const missingServices = serviceFiles.filter(file => {
  const filePath = path.join(servicesDir, file);
  return !fs.existsSync(filePath);
});

if (missingServices.length > 0) {
  console.warn('   ⚠️  Missing optional services:', missingServices.join(', '));
} else {
  console.log(`   ✅ All ${serviceFiles.length} service files found\n`);
}

// 4. Check middleware exists
console.log('✓ Checking middleware files...');
const middlewareFiles = ['auth.js', 'role.js', 'validate.js'];
const middlewareDir = path.join(__dirname, 'middleware');
const missingMiddleware = middlewareFiles.filter(file => !fs.existsSync(path.join(middlewareDir, file)));

if (missingMiddleware.length > 0) {
  console.error('❌ Missing middleware files:', missingMiddleware.join(', '));
  process.exit(1);
} else {
  console.log(`   ✅ All ${middlewareFiles.length} middleware files found\n`);
}

console.log('✅ All startup checks passed! API is ready to start.\n');

