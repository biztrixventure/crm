#!/usr/bin/env node

/**
 * API Diagnostic Helper
 * Run this to diagnose production issues with API 504 timeouts
 *
 * Usage: node api-diagnostic.js [--fix]
 */

import http from 'http';
import https from 'https';

const API_ENDPOINT = process.env.API_URL || 'http://localhost:4000';
const FIX_MODE = process.argv.includes('--fix');

console.log('🔍 BizTrixVenture API Diagnostic Tool\n');
console.log('Checking API at:', API_ENDPOINT);
console.log('---\n');

const tests = [
  {
    name: 'API Health Check',
    run: () => testEndpoint('/api/v1/health')
  },
  {
    name: 'Environment Variables',
    run: checkEnvironment
  },
  {
    name: 'Port Accessibility',
    run: () => checkPort(API_ENDPOINT)
  },
  {
    name: 'Database Connectivity',
    run: () => testEndpoint('/api/v1/auth/me', true) // Requires auth but tests DB
  }
];

async function run() {
  for (const test of tests) {
    try {
      console.log(`⏳ ${test.name}...`);
      const result = await test.run();
      if (result.ok) {
        console.log(`✅ ${result.message}\n`);
      } else {
        console.log(`❌ ${result.message}\n`);
        if (FIX_MODE && result.fix) {
          console.log(`   🔧 Attempting fix...\n`);
          result.fix();
        }
      }
    } catch (err) {
      console.log(`❌ Error: ${err.message}\n`);
    }
  }

  console.log('---\n📋 Summary:');
  console.log('If all tests pass, try:');
  console.log('  1. Refresh browser (Ctrl+Shift+R)');
  console.log('  2. Clear browser cache via DevTools');
  console.log('  3. Restart Docker containers');
  console.log('');
  console.log('If tests fail, run with --fix flag:');
  console.log('  node api-diagnostic.js --fix');
}

function testEndpoint(path, requiresAuth = false) {
  return new Promise((resolve) => {
    const url = new URL(API_ENDPOINT);
    const client = url.protocol === 'https:' ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port,
      path,
      method: 'GET',
      timeout: 5000,
      headers: requiresAuth ? { 'Authorization': 'Bearer test' } : {}
    };

    const req = client.request(options, (res) => {
      if (res.statusCode === 200 || res.statusCode === 401) {
        resolve({ ok: true, message: `${path} - Status ${res.statusCode}` });
      } else if (res.statusCode === 504) {
        resolve({
          ok: false,
          message: `${path} - 504 Gateway Timeout`,
          fix: () => fixGatewayTimeout()
        });
      } else {
        resolve({ ok: true, message: `${path} - Status ${res.statusCode}` });
      }
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        ok: false,
        message: `${path} - Request Timeout (30s)`,
        fix: () => fixTimeout()
      });
    });

    req.on('error', (err) => {
      resolve({
        ok: false,
        message: `${path} - ${err.code || err.message}`,
        fix: () => fixConnectionError(err.code)
      });
    });

    req.end();
  });
}

function checkEnvironment() {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'JWT_SECRET',
    'PORT'
  ];

  const missing = required.filter(v => !process.env[v]);

  if (missing.length === 0) {
    return Promise.resolve({ ok: true, message: 'All required variables set' });
  } else {
    return Promise.resolve({
      ok: false,
      message: `Missing: ${missing.join(', ')}`,
      fix: () => fixEnvironment()
    });
  }
}

function checkPort(endpoint) {
  const url = new URL(endpoint);
  return new Promise((resolve) => {
    const client = url.protocol === 'https:' ? https : http;

    const req = client.request(
      { hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80), path: '/', method: 'HEAD', timeout: 3000 },
      (res) => resolve({ ok: true, message: `Port ${url.port || 'default'} is accessible` })
    );

    req.on('error', (err) => {
      resolve({
        ok: false,
        message: `Cannot reach ${url.hostname}:${url.port || 'default'} - ${err.code}`,
        fix: () => fixPortAccess()
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, message: 'Port check timeout', fix: () => fixTimeout() });
    });

    req.end();
  });
}

function fixGatewayTimeout() {
  console.log('   Potential causes:');
  console.log('   - API service is down or crashing');
  console.log('   - Database connection is slow');
  console.log('   - API is overloaded');
  console.log('');
  console.log('   Try:');
  console.log('   1. docker-compose restart api');
  console.log('   2. Check API logs: docker logs -f biztrix-api-1');
  console.log('   3. Verify database is accessible');
}

function fixTimeout() {
  console.log('   The API is not responding quickly enough.');
  console.log('');
  console.log('   Try:');
  console.log('   1. Increase timeouts in nginx');
  console.log('   2. Check API CPU/Memory usage');
  console.log('   3. Optimize database queries');
}

function fixConnectionError(code) {
  console.log(`   Connection error: ${code}`);
  console.log('');
  if (code === 'ECONNREFUSED') {
    console.log('   API is not listening on the specified port.');
    console.log('   Try: docker-compose up -d api');
  } else if (code === 'ENOTFOUND') {
    console.log('   Cannot resolve hostname. Check DNS or network.');
  }
}

function fixEnvironment() {
  console.log('   Set the missing environment variables:');
  console.log('   export SUPABASE_URL=...');
  console.log('   export SUPABASE_SERVICE_KEY=...');
  console.log('   export JWT_SECRET=...');
  console.log('   export PORT=4000');
}

function fixPortAccess() {
  console.log('   The port is not accessible. Check:');
  console.log('   1. Firewall rules');
  console.log('   2. Docker port mappings');
  console.log('   3. nginx configuration');
}

// Run diagnostics
run();
