import { initializeApp, getApps, getApp } from 'firebase/app'
import { getDatabase, ref, set, get, update, onValue } from 'firebase/database'
import { MAX_BATSMEN } from './bcLogic'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

export function isBCFirebaseConfigured() {
  return !!(firebaseConfig.apiKey && firebaseConfig.databaseURL)
}

let db = null
function getDb() {
  if (!db) {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
    db = getDatabase(app)
  }
  return db
}

// Rooms live under games/ so existing Firebase rules (which cover games/) apply.
// Prefix "bc_" distinguishes Book Cricket rooms from Ciphera rooms.
function roomPath(roomId) {
  return `games/bc_${roomId}`
}

export async function createBCRoom(roomId, format, overs) {
  await set(ref(getDb(), roomPath(roomId)), {
    format,
    overs: overs || 0,
    createdAt: Date.now(),
    players: {
      host: { totalBalls: 0, totalRuns: 0, wickets: 0, currentBatsman: 0, done: false },
    },
  })
}

export async function getBCRoom(roomId) {
  const snap = await get(ref(getDb(), roomPath(roomId)))
  return snap.val()
}

export async function joinBCRoom(roomId) {
  const snap = await get(ref(getDb(), `${roomPath(roomId)}/players`))
  const existing = snap.val() || {}
  if (Object.keys(existing).length >= 2) return null   // max 2 players
  const playerId = 'g_' + Math.random().toString(36).slice(2, 8)
  await set(ref(getDb(), `${roomPath(roomId)}/players/${playerId}`), {
    totalBalls: 0, totalRuns: 0, wickets: 0, currentBatsman: 0, done: false,
  })
  return playerId
}

export function subscribeToBCRoom(roomId, callback) {
  return onValue(ref(getDb(), roomPath(roomId)), snap => callback(snap.val()))
}

export async function pushBCState(roomId, playerId, team) {
  const data = {
    totalBalls:     team.totalBalls,
    totalRuns:      team.totalRuns,
    wickets:        team.wickets,
    currentBatsman: team.currentBatsman,
    done:           team.done,
    batsmen:        team.batsmen,
  }
  if (team.history.length > 0) data.history = team.history
  await update(ref(getDb(), `${roomPath(roomId)}/players/${playerId}`), data)
}

function toArr(val, fallback) {
  if (!val) return fallback
  return Array.isArray(val) ? val : Object.values(val)
}

export function parseBCPlayer(data) {
  if (!data) return null
  return {
    batsmen:        toArr(data.batsmen, Array.from({ length: MAX_BATSMEN }, (_, i) => ({ name: `Bat ${i + 1}`, runs: 0, balls: 0, out: false }))),
    currentBatsman: data.currentBatsman ?? 0,
    totalRuns:      data.totalRuns      ?? 0,
    totalBalls:     data.totalBalls     ?? 0,
    wickets:        data.wickets        ?? 0,
    history:        toArr(data.history, []),
    done:           !!data.done,
  }
}
