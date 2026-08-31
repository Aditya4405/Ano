const { io } = require('socket.io-client');

const SOCKET_URL = 'http://localhost:3001';

async function runLifecycleTests() {
  console.log('🏁 STARTING DEMOLITION DERBY MULTIPLAYER LIFECYCLE TESTS...');

  const hostUserId = `host_${Date.now()}`;
  const p2UserId = `challenger_${Date.now()}`;

  const hostSocket = io(SOCKET_URL, { reconnection: false });
  const p2Socket = io(SOCKET_URL, { reconnection: false });

  const waitForConnect = (s) =>
    new Promise((res) => {
      if (s.connected) res();
      else s.on('connect', res);
    });

  await waitForConnect(hostSocket);
  await waitForConnect(p2Socket);
  console.log('✅ Sockets connected.');

  // Authenticate users
  hostSocket.emit('authenticate', { userId: hostUserId, nickname: 'HostRacer' });
  p2Socket.emit('authenticate', { userId: p2UserId, nickname: 'ChallengerRacer' });
  await new Promise((r) => setTimeout(r, 200));

  // 1. Host creates Derby Lobby
  let gameId = null;

  hostSocket.emit('lobby_create', {
    gameType: 'DEMOLITION_DERBY',
    userId: hostUserId,
    nickname: 'HostRacer',
    settings: { arenaId: 'industrial_yard', maxPlayers: 8 },
  });

  await new Promise((res) => {
    hostSocket.on('lobby_state', (lobby) => {
      if (lobby && !gameId) {
        gameId = lobby.id;
        console.log(`✅ Game lobby created: ${gameId}`);
        res();
      }
    });
  });

  // 2. Challenger joins lobby
  p2Socket.emit('lobby_join', { gameId, userId: p2UserId, nickname: 'ChallengerRacer' });

  await new Promise((res) => {
    p2Socket.on('lobby_state', (lobby) => {
      if (lobby && lobby.players && lobby.players.length >= 2) {
        console.log(`✅ Challenger joined lobby: ${lobby.id}, player count: ${lobby.players.length}`);
        res();
      }
    });
  });

  // 3. Set ready status for non-host
  p2Socket.emit('lobby_ready', { gameId, userId: p2UserId, isReady: true });
  await new Promise((r) => setTimeout(r, 300));

  // 4. Test Idempotency & Lifecycle: Trigger game_start twice simultaneously
  console.log('\n--- TESTING START MATCH IDEMPOTENCY ---');
  let countdownEvents = [];
  let gameStartedEvents = [];
  let arenasSeen = new Set();
  let matchIdsSeen = new Set();

  hostSocket.on('game_countdown', (data) => {
    countdownEvents.push(data);
    if (data.arenaId) arenasSeen.add(data.arenaId);
    if (data.matchId) matchIdsSeen.add(data.matchId);
    console.log(`[COUNTDOWN] value=${data.countdownValue}, matchId=${data.matchId}, arenaId=${data.arenaId}`);
  });

  hostSocket.on('game_started', (data) => {
    gameStartedEvents.push(data);
    if (data.matchId) matchIdsSeen.add(data.matchId);
    console.log(`[GAME_STARTED] status=${data.status}, matchId=${data.matchId}`);
  });

  // Trigger double start
  hostSocket.emit('game_start', { gameId, hostId: hostUserId });
  hostSocket.emit('game_start', { gameId, hostId: hostUserId });

  // Wait 4.5 seconds for countdown sequence (3 -> 2 -> 1 -> GO) to complete
  await new Promise((r) => setTimeout(r, 4500));

  console.log('\n--- LIFECYCLE AUDIT RESULTS ---');
  console.log(`Countdown ticks received: ${countdownEvents.length} (Expected 3: values 3, 2, 1)`);
  console.log(`Game started events: ${gameStartedEvents.length} (Expected 1)`);
  console.log(`Unique match IDs: ${matchIdsSeen.size} (Expected 1)`);
  console.log(`Unique arenas: ${arenasSeen.size} (Expected 1)`);

  if (matchIdsSeen.size !== 1) {
    throw new Error(`FAILED: Multiple match IDs generated: ${[...matchIdsSeen].join(', ')}`);
  }
  if (arenasSeen.size !== 1) {
    throw new Error(`FAILED: Multiple arenas generated during match`);
  }
  if (gameStartedEvents.length !== 1) {
    throw new Error(`FAILED: Expected exactly 1 game_started event, got ${gameStartedEvents.length}`);
  }
  if (countdownEvents.length !== 3) {
    throw new Error(`FAILED: Expected exactly 3 countdown ticks (3,2,1), got ${countdownEvents.length}`);
  }

  // 5. Test In-Game Transform and Collision Sync
  console.log('\n--- TESTING IN-GAME TRANSFORM & IMPACT SYNC ---');
  let syncReceivedByP2 = false;
  let collisionReceived = false;

  p2Socket.on('derby_player_sync', (data) => {
    if (data.userId === hostUserId && data.x === 12.5) {
      syncReceivedByP2 = true;
    }
  });

  hostSocket.on('derby_collision_effect', (data) => {
    if (data.attackerId === hostUserId && data.targetId === p2UserId) {
      collisionReceived = true;
    }
  });

  // Send transform from Host
  hostSocket.emit('derby_transform_update', {
    gameId,
    userId: hostUserId,
    x: 12.5,
    y: 0,
    z: -5.0,
    rotationY: 1.57,
    vx: 15,
    vy: 0,
    vz: 0,
    hp: 95,
  });

  // Send hit impact from Host onto P2
  hostSocket.emit('derby_hit_impact', {
    gameId,
    attackerId: hostUserId,
    targetId: p2UserId,
    impactSpeed: 24,
    attackerRam: 70,
    targetArmor: 55,
    hitX: 12.5,
    hitY: 0.5,
    hitZ: -5.0,
  });

  await new Promise((r) => setTimeout(r, 600));

  // 6. Test Fatal Hit & Authoritative Game Over
  console.log('\n--- TESTING FATAL IMPACT & AUTHORITATIVE GAME OVER ---');
  let eliminationReceived = false;
  let gameOverReceived = false;
  let finalResults = null;

  p2Socket.on('derby_vehicle_eliminated', (data) => {
    if (data.eliminatedId === p2UserId) {
      eliminationReceived = true;
      console.log(`[ELIMINATION] Player ${data.eliminatedId} wrecked by ${data.attackerId}, rank=${data.rank}`);
    }
  });

  hostSocket.on('game_over', (data) => {
    gameOverReceived = true;
    finalResults = data.results;
    console.log(`[GAME_OVER] Match ${data.matchId} finished. Results:`, data.results?.map((r) => `${r.nickname}: Rank ${r.rank} (${r.score} pts)`).join(', '));
  });

  // Host delivers fatal blow (100 dmg) to Challenger (who had ~75 HP remaining)
  await new Promise((r) => setTimeout(r, 300));
  hostSocket.emit('derby_hit_impact', {
    gameId,
    attackerId: hostUserId,
    targetId: p2UserId,
    damage: 100,
    impactSpeed: 35,
    attackerRam: 100,
    targetArmor: 50,
    hitX: 12.5,
    hitY: 0.5,
    hitZ: -5.0,
  });

  await new Promise((r) => setTimeout(r, 800));

  console.log(`Elimination event received: ${eliminationReceived ? 'YES' : 'NO'}`);
  console.log(`Game Over broadcast received: ${gameOverReceived ? 'YES' : 'NO'}`);

  if (!eliminationReceived) {
    throw new Error('FAILED: derby_vehicle_eliminated event was not broadcast');
  }
  if (!gameOverReceived || !finalResults) {
    throw new Error('FAILED: game_over event was not broadcast with results');
  }

  const winner = finalResults.find((r) => r.rank === 1);
  console.log(`Authoritative Winner: ${winner ? winner.nickname : 'None'}`);

  if (!winner || winner.userId !== hostUserId) {
    throw new Error(`FAILED: Expected Host to be winner (Rank 1), got ${winner ? winner.userId : 'none'}`);
  }

  // 7. Test Return to Lobby & Manual Rematch Flow
  console.log('\n--- TESTING RETURN TO LOBBY & MANUAL REMATCH ---');
  let restoredLobbyReceived = false;

  p2Socket.on('lobby_state', (lobby) => {
    if (lobby && lobby.status === 'WAITING') {
      restoredLobbyReceived = true;
      console.log(`[LOBBY_RESTORED] Lobby ${lobby.id} returned to WAITING. Player count: ${lobby.players?.length}`);
    }
  });

  // Host clicks "RETURN TO LOBBY"
  hostSocket.emit('derby_reset_lobby', { gameId });
  await new Promise((r) => setTimeout(r, 600));

  if (!restoredLobbyReceived) {
    throw new Error('FAILED: derby_reset_lobby did not restore lobby to WAITING');
  }

  // 8. Test Starting Round 2: Challenger readies up, Host manually starts Round 2
  console.log('\n--- TESTING ROUND 2 REMATCH (FRESH HEALTH & UNIQUE MATCH ID) ---');
  p2Socket.emit('lobby_ready', { gameId, userId: p2UserId, isReady: true });
  await new Promise((r) => setTimeout(r, 300));

  let round2CountdownReceived = false;
  let round2StartedData = null;

  hostSocket.on('game_countdown', (data) => {
    if (data.matchId && data.matchId !== matchIdsSeen.values().next().value) {
      round2CountdownReceived = true;
      console.log(`[ROUND 2 COUNTDOWN] matchId=${data.matchId}, value=${data.countdownValue}`);
    }
  });

  hostSocket.on('game_started', (data) => {
    if (data.matchId && data.matchId !== matchIdsSeen.values().next().value) {
      round2StartedData = data;
      console.log(`[ROUND 2 STARTED] matchId=${data.matchId}, status=${data.status}`);
    }
  });

  hostSocket.emit('game_start', { gameId, hostId: hostUserId });
  await new Promise((r) => setTimeout(r, 4500));

  if (!round2CountdownReceived) {
    throw new Error('FAILED: Round 2 countdown was not received with new matchId');
  }
  if (!round2StartedData) {
    throw new Error('FAILED: Round 2 game_started event was not received');
  }

  // Verify all players have fresh 100 HP in Round 2
  const p1Round2 = round2StartedData.playerStates.find((p) => p.userId === hostUserId);
  const p2Round2 = round2StartedData.playerStates.find((p) => p.userId === p2UserId);

  console.log(`Round 2 Player 1 HP: ${p1Round2?.hp} (Expected 100)`);
  console.log(`Round 2 Player 2 HP: ${p2Round2?.hp} (Expected 100)`);

  if (p1Round2?.hp !== 100 || p2Round2?.hp !== 100) {
    throw new Error('FAILED: Round 2 did not reset player HP to 100');
  }

  // Verify unique spawn positions in Round 2
  console.log(`Round 2 Player 1 Spawn: (${Math.round(p1Round2.x)}, ${Math.round(p1Round2.z)})`);
  console.log(`Round 2 Player 2 Spawn: (${Math.round(p2Round2.x)}, ${Math.round(p2Round2.z)})`);

  if (p1Round2.x === p2Round2.x && p1Round2.z === p2Round2.z) {
    throw new Error('FAILED: Players spawned at identical coordinates in Round 2');
  }

  console.log('\n🎉 ALL MULTIPLAYER LIFECYCLE, HEALTH, DESTRUCTION, GAME-OVER & REMATCH TESTS PASSED PERFECTLY!\n');

  hostSocket.disconnect();
  p2Socket.disconnect();
  process.exit(0);
}

runLifecycleTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
