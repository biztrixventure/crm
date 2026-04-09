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

        // Create persistent notification
        try {
          const { error: notifError } = await supabase
            .from('notifications')
            .insert({
              user_id: callback.created_by,
              role: 'closer', // Will be updated when we fetch the user's actual role
              type: 'callback:due',
              title: 'Callback Reminder',
              message: `Callback reminder: ${callback.customer_name}`,
              metadata: {
                callbackId: callback.id,
                customerName: callback.customer_name,
                customerPhone: callback.customer_phone,
              },
            });

          if (notifError) {
            console.warn(`Failed to create persistent notification for ${callbackId}:`, notifError);
          }
        } catch (notifErr) {
          console.warn(`Error creating persistent notification for ${callbackId}:`, notifErr);
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

async function checkComplianceBatchReminders() {
  try {
    // Find batches pending for 24+ hours with assigned agents
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: pendingBatches, error } = await supabase
      .from('compliance_batches')
      .select('id, assigned_to, created_at')
      .eq('status', 'pending')
      .lt('created_at', oneDayAgo)
      .not('assigned_to', 'is', null);

    if (error) {
      console.error('Error fetching pending batches:', error);
      return;
    }

    if (!pendingBatches || pendingBatches.length === 0) {
      return;
    }

    console.log(`Found ${pendingBatches.length} batches pending for 24+ hours`);

    // Emit reminder to each assigned agent
    for (const batch of pendingBatches) {
      if (socket && socket.connected) {
        socket.emit('compliance:batch_reminder', {
          agentId: batch.assigned_to,
          batchId: batch.id,
          message: 'Reminder: You have a compliance batch pending review for 24+ hours',
          timestamp: new Date().toISOString(),
        });
        console.log(`✅ Sent batch reminder to agent ${batch.assigned_to}`);
      }
    }
  } catch (err) {
    console.error('Error in checkComplianceBatchReminders:', err);
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

  // Start polling loop for callbacks (every 30 seconds)
  console.log(`📡 Polling callbacks every 30 seconds`);
  setInterval(processCallbacks, POLL_INTERVAL);

  // Start batch reminder check (every 60 minutes)
  console.log(`📡 Checking batch reminders every 60 minutes`);
  setInterval(checkComplianceBatchReminders, 60 * 60 * 1000);

  // Run callbacks immediately on start
  await processCallbacks();

  // Check batch reminders immediately on start
  await checkComplianceBatchReminders();
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
