/**
 * Automated Redis & Ephemeral Infrastructure Integration Test Suite
 * Run with: node server/tests/redisIntegration.test.js
 */

const assert = require('assert');
const { getRedisClient, isRedisAvailable, closeRedis } = require('../lib/redis');
const cache = require('../lib/cache');
const { checkRateLimit } = require('../lib/rateLimiter');
const presenceService = require('../services/presenceService');

// Colors for terminal reporting
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

async function runTests() {
  console.log(`\n${CYAN}====================================================${RESET}`);
  console.log(`${CYAN}   ANO REDIS & EPHEMERAL INFRASTRUCTURE TEST SUITE   ${RESET}`);
  console.log(`${CYAN}====================================================\n${RESET}`);

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`${GREEN}  ✓ ${name}${RESET}`);
      passed++;
    } catch (err) {
      console.error(`${RED}  ✗ ${name}${RESET}`);
      console.error(`    ${RED}Error: ${err.message}${RESET}`);
      failed++;
    }
  }

  // --- Test 1: Redis Client & Connection Graceful Fallback ---
  await test('TEST 1: Redis client initialization & status inspection', async () => {
    const client = getRedisClient();
    assert(client !== null, 'Redis client instance must be returned');
    // Regardless of whether local Redis daemon is running or not, isRedisAvailable() must return boolean without throwing
    const available = isRedisAvailable();
    assert(typeof available === 'boolean', 'isRedisAvailable must return boolean');
  });

  // --- Test 2: Cache Layer (set, get, wrap, del, delPattern) ---
  await test('TEST 2: Cache layer set, get, wrap, del & pattern invalidation', async () => {
    const testKey = 'test:metadata:sample';
    const testData = { id: 123, name: 'Ano Gaming', tags: ['dsa', 'gaming'] };

    // 1. Set
    await cache.set(testKey, testData, 30);

    // 2. Get
    const fetched = await cache.get(testKey);
    assert.deepStrictEqual(fetched, testData, 'Cached item should match original');

    // 3. Wrap (fetch-and-cache)
    let fetchCount = 0;
    const wrapKey = 'test:wrap:sample';
    const fetcher = async () => {
      fetchCount++;
      return { answer: 42 };
    };

    const firstWrap = await cache.wrap(wrapKey, fetcher, 30);
    const secondWrap = await cache.wrap(wrapKey, fetcher, 30);
    assert.strictEqual(firstWrap.answer, 42);
    assert.strictEqual(secondWrap.answer, 42);
    assert.strictEqual(fetchCount, 1, 'Fetcher should only execute once');

    // 4. Del
    await cache.del(testKey);
    const afterDel = await cache.get(testKey);
    assert.strictEqual(afterDel, null, 'Deleted key must return null');

    // 5. Pattern Deletion
    await cache.set('test:feed:1', { page: 1 }, 30);
    await cache.set('test:feed:2', { page: 2 }, 30);
    await cache.delPattern('test:feed:*');
  });

  // --- Test 3: Rate Limiter Atomic Counters & Limits ---
  await test('TEST 3: Rate limiter increments, remaining tokens, and threshold block', async () => {
    const action = 'test:chat_message';
    const testUser = `user_${Date.now()}`;
    const windowMs = 5000;
    const maxRequests = 3;

    const res1 = await checkRateLimit(action, testUser, windowMs, maxRequests);
    assert.strictEqual(res1.allowed, true, '1st request must be allowed');
    assert.strictEqual(res1.remaining, 2, '2 remaining requests expected');

    const res2 = await checkRateLimit(action, testUser, windowMs, maxRequests);
    assert.strictEqual(res2.allowed, true, '2nd request must be allowed');
    assert.strictEqual(res2.remaining, 1, '1 remaining request expected');

    const res3 = await checkRateLimit(action, testUser, windowMs, maxRequests);
    assert.strictEqual(res3.allowed, true, '3rd request must be allowed');
    assert.strictEqual(res3.remaining, 0, '0 remaining requests expected');

    const res4 = await checkRateLimit(action, testUser, windowMs, maxRequests);
    assert.strictEqual(res4.allowed, false, '4th request must be rate-limited (blocked)');
    assert.strictEqual(res4.remaining, 0);
  });

  // --- Test 4: Presence State Lifecycle (ONLINE -> PLAYING -> SPECTATING -> OFFLINE) ---
  await test('TEST 4: Presence state transitions & spectator support', async () => {
    const testUserId = `test_player_${Date.now()}`;
    const testSocketId = `socket_${Date.now()}_1`;

    // 1. Online
    const onlinePres = await presenceService.setOnline(testUserId, testSocketId);
    assert.strictEqual(onlinePres.status, 'ONLINE', 'Initial status must be ONLINE');
    assert.strictEqual(onlinePres.game, null);

    // 2. Enter Active Game (Chamber Clash)
    const playingPres = await presenceService.setPlaying(testUserId, testSocketId, {
      gameId: 'cc_game_123',
      gameType: 'CHAMBER_CLASH',
      isSpectating: false
    });
    assert.strictEqual(playingPres.status, 'PLAYING', 'Status must transition to PLAYING');
    assert.strictEqual(playingPres.game.gameName, 'Chamber Clash');
    assert.strictEqual(playingPres.game.isSpectating, false);

    // 3. Eliminated -> Spectating
    const spectatingPres = await presenceService.setPlaying(testUserId, testSocketId, {
      gameId: 'cc_game_123',
      gameType: 'CHAMBER_CLASH',
      isSpectating: true
    });
    assert.strictEqual(spectatingPres.status, 'PLAYING');
    assert.strictEqual(spectatingPres.game.isSpectating, true, 'Player should be marked as spectator');

    // 4. Leave Game -> Back to Online
    const clearedPres = await presenceService.clearPlaying(testUserId, testSocketId, 'cc_game_123');
    assert.strictEqual(clearedPres.status, 'ONLINE', 'Status should return to ONLINE after game finish/leave');

    // 5. Disconnect -> Offline
    const offlinePres = await presenceService.handleSocketDisconnect(testUserId, testSocketId);
    assert.strictEqual(offlinePres.status, 'OFFLINE', 'Status must become OFFLINE on disconnect');
  });

  // --- Test 5: Multi-Tab Safety Aggregation ---
  await test('TEST 5: Multi-tab session safety (Tab 1 in game + Tab 2 browsing)', async () => {
    const testUserId = `test_multitab_${Date.now()}`;
    const tab1Socket = `tab1_${Date.now()}`;
    const tab2Socket = `tab2_${Date.now()}`;

    // Tab 1: Connect and start playing Flappy Bird
    await presenceService.setOnline(testUserId, tab1Socket);
    await presenceService.setPlaying(testUserId, tab1Socket, {
      gameId: 'flappy_lobby_99',
      gameType: 'FLAPPY_BIRD'
    });

    // Tab 2: User opens Ano in another tab (browsing feed)
    await presenceService.setOnline(testUserId, tab2Socket);

    // Verify user presence remains PLAYING
    const currentPres = await presenceService.getPresence(testUserId);
    assert.strictEqual(currentPres.status, 'PLAYING', 'Multi-tab user must remain PLAYING while Tab 1 is active');
    assert.strictEqual(currentPres.game.gameName, 'Flappy Bird');

    // Close Tab 2 (browsing tab)
    await presenceService.handleSocketDisconnect(testUserId, tab2Socket);

    // User must STILL be PLAYING because Tab 1 is running
    const afterTab2Close = await presenceService.getPresence(testUserId);
    assert.strictEqual(afterTab2Close.status, 'PLAYING', 'User must still be PLAYING after closing browsing tab');

    // Close Tab 1 (game tab)
    const finalPres = await presenceService.handleSocketDisconnect(testUserId, tab1Socket);
    assert.strictEqual(finalPres.status, 'OFFLINE', 'User should be OFFLINE after all tabs are closed');
  });

  // --- Test 6: Presence Heartbeat Touch ---
  await test('TEST 6: Presence heartbeat touch preserves TTL without throwing', async () => {
    const testUserId = `test_touch_${Date.now()}`;
    const testSocketId = `socket_touch_${Date.now()}`;

    await presenceService.setOnline(testUserId, testSocketId);
    await presenceService.touchPresence(testUserId, testSocketId);
    await presenceService.handleSocketDisconnect(testUserId, testSocketId);
  });

  // Summary
  console.log(`\n${CYAN}====================================================${RESET}`);
  console.log(`Test Results: ${GREEN}${passed} Passed${RESET}, ${failed > 0 ? RED : GREEN}${failed} Failed${RESET}`);
  console.log(`${CYAN}====================================================\n${RESET}`);

  await closeRedis();

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
