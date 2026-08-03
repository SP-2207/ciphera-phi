import { initializeApp, getApps, getApp } from 'firebase/app'
import { getDatabase, ref, set, get, update, onValue } from 'firebase/database'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

let db = null
function getDb() {
  if (!db) {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
    db = getDatabase(app)
  }
  return db
}

function roomPath(roomId) {
  return `games/pf_${roomId}`
}

// ── Serialise / deserialise ───────────────────────────────────────────────────

function serializePen(pen) {
  if (!pen) return null
  return { x: pen.x, y: pen.y, a: pen.angle }
}

function deserializePen(raw) {
  if (!raw) return null
  return { x: raw.x, y: raw.y, angle: raw.a ?? 0 }
}

export function serializeGameState(state) {
  const lf = state.lastFlick
  return {
    totalRounds:  state.totalRounds,
    scores:       state.scores  || {},
    tieRounds:    state.tieRounds || 0,
    currentRound: state.currentRound || 1,
    phase:        state.phase || 'placement',
    pen1:         serializePen(state.pen1),
    pen2:         serializePen(state.pen2),
    p1Placed:     state.p1Placed || false,
    p2Placed:     state.p2Placed || false,
    firstTurn:    state.firstTurn || null,
    currentTurn:  state.currentTurn || null,
    lastResult:   state.lastResult || null,
    // Flick params so the viewer can re-run the real simulation, not just lerp
    lastFlick:    lf ? {
      slot:  lf.slot,
      power: lf.power,
      dir:   lf.dir,
      from1: serializePen(lf.fromP1),
      from2: serializePen(lf.fromP2),
    } : null,
  }
}

export function deserializeGameState(raw) {
  if (!raw) return null
  const lf = raw.lastFlick
  return {
    totalRounds:  raw.totalRounds,
    scores:       raw.scores  || {},
    tieRounds:    raw.tieRounds || 0,
    currentRound: raw.currentRound || 1,
    phase:        raw.phase || 'placement',
    pen1:         deserializePen(raw.pen1),
    pen2:         deserializePen(raw.pen2),
    p1Placed:     raw.p1Placed || false,
    p2Placed:     raw.p2Placed || false,
    firstTurn:    raw.firstTurn || null,
    currentTurn:  raw.currentTurn || null,
    lastResult:   raw.lastResult || null,
    lastFlick:    lf ? {
      slot:  lf.slot,
      power: lf.power,
      dir:   lf.dir,
      fromP1: deserializePen(lf.from1),
      fromP2: deserializePen(lf.from2),
    } : null,
  }
}

// ── Room management ──────────────────────────────────────────────────────────

export async function createPFRoom(roomId, rounds, hostInitials) {
  const hostId = 'p_' + Math.random().toString(36).slice(2, 8)
  await set(ref(getDb(), roomPath(roomId)), {
    playerCount: 2,
    rounds,
    phase:       'waiting',
    createdAt:   Date.now(),
    players: {
      [hostId]: { initials: hostInitials, slot: 0, isHost: true },
    },
  })
  return hostId
}

export async function getPFRoom(roomId) {
  const snap = await get(ref(getDb(), roomPath(roomId)))
  return snap.val()
}

export async function joinPFRoom(roomId, initials) {
  const snap = await get(ref(getDb(), roomPath(roomId)))
  const room = snap.val()
  if (!room) return null
  const existing = room.players ? Object.values(room.players) : []
  if (existing.length >= (room.playerCount || 2)) return null
  const playerId = 'p_' + Math.random().toString(36).slice(2, 8)
  await update(ref(getDb(), `${roomPath(roomId)}/players/${playerId}`), {
    initials,
    slot:   existing.length,
    isHost: false,
  })
  return { playerId, slot: existing.length }
}

export function subscribeToPFRoom(roomId, callback) {
  return onValue(ref(getDb(), roomPath(roomId)), snap => callback(snap.val()))
}

// Host sets toss call + result, transitions to toss phase
export async function startPFToss(roomId, call, result, winnerId) {
  await update(ref(getDb(), roomPath(roomId)), {
    phase: 'toss',
    toss:  { call, result, winner: winnerId },
  })
}

// Host starts game with initial game state (after toss)
export async function startPFGame(roomId, initialGameState) {
  await update(ref(getDb(), roomPath(roomId)), {
    phase:     'playing',
    gameState: serializeGameState(initialGameState),
  })
}

// Push updated game state after placement or flick
export async function pushPFGameState(roomId, gameState) {
  await update(ref(getDb(), roomPath(roomId)), {
    phase:     gameState.phase === 'done' ? 'done' : 'playing',
    gameState: serializeGameState(gameState),
  })
}
