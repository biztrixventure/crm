import 'dotenv/config';
import Redis from 'ioredis';
import { createClient } from '@supabase/supabase-js';
import { io } from 'socket.io-client';

// Configuration
const POLL_INTERVAL = 30000; // 30 seconds
const API_URL = process.env.API_URL || 'http://api:4000';
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

// Initialize services
const redis = new Redis(REDIS_URL);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Socket.io client for emitting notifications
let socket = null;

function connectSocket() {
  socket = io(API_URL, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('✅ Connected to API socket');
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected from API socket');
  });

  socket.on('error', (err) => {
    console.error('Socket error:', err);
  });
}

async function processCallbacks() {
  const now = Math.floor(Date.now() / 1000);
  
  try {
    // Get all callbacks due for notification
    const dueCallbackIds = await redis.zrangebyscore('cb:queue', 0, now);
    
    if (dueCallbackIds.length === 0) {
      return;
    }

    console.log(`Processing ${dueCallbackIds.length} due callbacks...`);

    for (const callbackId of dueCallbackIds) {
      try {
        // Get callback details
        const { data: callback, error: fetchError } = await supabase
          .from('callbacks')
          .select(`
            id,
            created_by,
            customer_name,
            customer_phone,
            best_time,
            notes,
            is_fired
          `)
          .eq('id', callbackId)
          .single();

        if (fetchError || !callback) {
          console.log(`Callback ${callbackId} not found, removing from queue`);
          await redis.zrem('cb:queue', callbackId);
          continue;
        }

        // Skip if already fired (idempotency check)
        if (callback.is_fired) {
          console.log(`Callback ${callbackId} already fired, removing from queue`);
          await redis.zrem('cb:queue', callbackId);
          continue;
        }

        // Mark as fired in database (atomic)
        const { error: updateError } = await supabase
          .from('callbacks')
          .update({ is_fired: true })
          .eq('id', callbackId)
          .eq('is_fired', false); // Optimistic locking

        if (updateError) {
          console.error(`Failed to update callback ${callbackId}:`, updateError);
          continue;
        }

        // Emit notification to user
        if (socket && socket.connected) {
          socket.emit('callback:fire', {
            userId: callback.created_by,
            callback: {
              id: callback.id,
              customer_name: callback.customer_name,
              customer_phone: callback.customer_phone,
              notes: callback.notes,
            },
          });
          console.log(`✅ Fired callback ${callbackId} to user ${callback.created_by}`);
        } else {
          console.warn(`Socket not connected, callback ${callbackId} notification not sent`);
        }

        // Remove from Redis queue
        await redis.zrem('cb:queue', callbackId);

      } catch (err) {
        console.error(`Error processing callback ${callbackId}:`, err);
      }
    }
  } catch (err) {
    console.error('Error in processCallbacks:', err);
  }
}

async function startWorker() {
  console.log('🚀 BizTrixVenture Callback Worker starting...');
  
  // Connect to Redis
  redis.on('connect', () => {
    console.log('✅ Redis connected');
  });
  
  redis.on('error', (err) => {
    console.error('Redis error:', err);
  });

  // Connect socket
  connectSocket();

  // Start polling loop
  console.log(`📡 Polling every ${POLL_INTERVAL / 1000} seconds`);
  
  setInterval(processCallbacks, POLL_INTERVAL);
  
  // Run immediately on start
  await processCallbacks();
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down...');
  if (socket) socket.disconnect();
  await redis.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down...');
  if (socket) socket.disconnect();
  await redis.quit();
  process.exit(0);
});

// Start the worker
startWorker().catch(console.error);
