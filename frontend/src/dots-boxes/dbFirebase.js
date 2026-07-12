import { initializeApp, getApps, getApp } from 'firebase/app'
import { getDatabase, ref, set, get, update, onValue } from 'firebase/database'
import { H_COUNT, V_COUNT, BOX_COUNT } from './dbLogic'

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

// Room lives under games/ so existing Firebase rules apply.
function roomPath(roomId) {
  return `games/dots_${roomId}`
}

// ── Serialisation ────────────────────────────────────────────────────────────
// Firebase rejects null values in arrays.
// We store lines/boxes as sparse objects: { "idx": "playerId", ... }.

function toSparse(arr) {
  return arr.reduce((obj, v, i) => (v ? { ...obj, [i]: v } : obj), {})
}

function fromSparse(sparse, length) {
  const arr = Array(length).fill(null)
  if (sparse && typeof sparse === 'object') {
    Object.entries(sparse).forEach(([k, v]) => { arr[parseInt(k, 10)] = v })
  }
  return arr
}

export function serializeGameState(state) {
  return {
    h:             toSparse(state.hLines),
    v:             toSparse(state.vLines),
    bx:            toSparse(state.boxes),
    scores:        state.scores        || {},
    currentSlot:   state.currentSlot   ?? 0,
    moveCount:     state.moveCount     ?? 0,
    phase:         state.phase         || 'playing',
    turnStartedAt: state.turnStartedAt || Date.now(),
  }
}

export function deserializeGameState(raw) {
  if (!raw) return null
  return {
    hLines:        fromSparse(raw.h,  H_COUNT),
    vLines:        fromSparse(raw.v,  V_COUNT),
    boxes:         fromSparse(raw.bx, BOX_COUNT),
    scores:        raw.scores        || {},
    currentSlot:   raw.currentSlot   ?? 0,
    moveCount:     raw.moveCount     ?? 0,
    phase:         raw.phase         || 'playing',
    turnStartedAt: raw.turnStartedAt || Date.now(),
  }
}

// ── Room management ──────────────────────────────────────────────────────────

/**
 * Create a new room. Returns the host's playerId.
 */
export async function createDBRoom(roomId, playerCount, hostInitials) {
  const hostId = 'p_' + Math.random().toString(36).slice(2, 8)
  await set(ref(getDb(), roomPath(roomId)), {
    playerCount,
    phase:     'waiting',
    createdAt: Date.now(),
    players: {
      [hostId]: { initials: hostInitials, slot: 0, isHost: true },
    },
  })
  return hostId
}

export async function getDBRoom(roomId) {
  const snap = await get(ref(getDb(), roomPath(roomId)))
  return snap.val()
}

/**
 * Join an existing room. Returns { playerId, slot } or null if full / not found.
 */
export async function joinDBRoom(roomId, initials) {
  const snap = await get(ref(getDb(), roomPath(roomId)))
  const room = snap.val()
  if (!room) return null

  const existing     = room.players ? Object.values(room.players) : []
  const playerCount  = room.playerCount || 2
  if (existing.length >= playerCount) return null

  const slot     = existing.length
  const playerId = 'p_' + Math.random().toString(36).slice(2, 8)

  await update(ref(getDb(), `${roomPath(roomId)}/players/${playerId}`), {
    initials,
    slot,
    isHost: false,
  })

  return { playerId, slot }
}

export function subscribeToDBRoom(roomId, callback) {
  return onValue(ref(getDb(), roomPath(roomId)), snap => callback(snap.val()))
}

/**
 * Host calls this when the lobby is full; sets phase → 'playing' and writes initial gameState.
 */
export async function startDBGame(roomId, initialGameState) {
  await update(ref(getDb(), roomPath(roomId)), {
    phase:     'playing',
    gameState: serializeGameState(initialGameState),
  })
}

/**
 * Push updated game state after each move.
 */
export async function pushDBGameState(roomId, gameState) {
  await update(ref(getDb(), roomPath(roomId)), {
    phase:     gameState.phase === 'done' ? 'done' : 'playing',
    gameState: serializeGameState(gameState),
  })
}
