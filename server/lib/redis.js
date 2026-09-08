let Redis = null;
try {
  Redis = require('ioredis');
} catch (e) {
  // ioredis not installed in this environment; fallback to memory
}

let primaryClient = null;
let pubClient = null;
let subClient = null;
let lastLoggedError = null;
let lastLoggedStatus = null;

/**
 * Build ioredis client configuration options
 */
function getRedisOptions(customOptions = {}) {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  
  return {
    lazyConnect: true,
    maxRetriesPerRequest: 1, // Fail fast on commands when disconnected so app fallback triggers immediately
    enableReadyCheck: true,
    autoResubscribe: true,
    autoResendUnfulfilledCommands: false,
    retryStrategy(times) {
      // Exponential backoff capped at 5 seconds
      const delay = Math.min(times * 200, 5000);
      return delay;
    },
    reconnectOnError(err) {
      const targetErrors = ['READONLY', 'ETIMEDOUT', 'ECONNRESET'];
      return targetErrors.some(target => err.message.includes(target));
    },
    ...customOptions
  };
}

/**
 * Initialize and attach listeners to a Redis instance
 */
function setupClient(client, name = 'Primary') {
  client.on('connect', () => {
    if (lastLoggedStatus !== 'connecting') {
      console.log(`[Redis:${name}] Connecting to Redis server...`);
      lastLoggedStatus = 'connecting';
    }
  });

  client.on('ready', () => {
    console.log(`[Redis:${name}] Connection established and ready.`);
    lastLoggedStatus = 'ready';
    lastLoggedError = null;
  });

  client.on('error', (err) => {
    // Avoid spamming logs with identical connection refused messages
    const errSummary = `${err.code || err.name}: ${err.message}`;
    if (lastLoggedError !== errSummary) {
      console.warn(`[Redis:${name}] Connection warning: ${errSummary}. (Ephemeral features falling back to memory)`);
      lastLoggedError = errSummary;
    }
  });

  client.on('close', () => {
    if (lastLoggedStatus === 'ready') {
      console.warn(`[Redis:${name}] Connection closed.`);
      lastLoggedStatus = 'closed';
    }
  });

  client.on('reconnecting', (delay) => {
    // Log once per reconnect cycle
    if (lastLoggedStatus !== 'reconnecting') {
      console.log(`[Redis:${name}] Reconnecting in ${delay}ms...`);
      lastLoggedStatus = 'reconnecting';
    }
  });

  return client;
}

/**
 * Get or create the singleton primary Redis client
 */
function getRedisClient() {
  if (!Redis) return null;
  if (!primaryClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    try {
      const client = new Redis(redisUrl, getRedisOptions());
      primaryClient = setupClient(client, 'Primary');
      primaryClient.connect().catch((err) => {
        // Handled via client.on('error')
      });
    } catch (err) {
      console.warn('[Redis] Failed to instantiate Redis client:', err.message);
      primaryClient = null;
    }
  }
  return primaryClient;
}

/**
 * Create a new standalone Redis client instance (e.g. for Pub/Sub or Socket.IO adapter)
 */
function createRedisClient(name = 'Worker') {
  if (!Redis) return null;
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  try {
    const client = new Redis(redisUrl, getRedisOptions());
    return setupClient(client, name);
  } catch (err) {
    console.warn(`[Redis:${name}] Failed to create client:`, err.message);
    return null;
  }
}

/**
 * Check if primary Redis client is online and responding
 */
function isRedisAvailable() {
  return Boolean(primaryClient && primaryClient.status === 'ready');
}

/**
 * Gracefully close all Redis connections
 */
async function closeRedis() {
  const clients = [primaryClient, pubClient, subClient].filter(Boolean);
  await Promise.all(
    clients.map(async (c) => {
      try {
        if (c.status === 'ready' || c.status === 'connecting') {
          await c.quit();
        } else {
          c.disconnect();
        }
      } catch (err) {
        c.disconnect();
      }
    })
  );
  primaryClient = null;
  pubClient = null;
  subClient = null;
  console.log('[Redis] All connections closed cleanly.');
}

module.exports = {
  getRedisClient,
  createRedisClient,
  isRedisAvailable,
  closeRedis,
  getRedisOptions,
};
