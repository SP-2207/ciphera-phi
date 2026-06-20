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

export function isFirebaseConfigured() {
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

export async function createRoom(roomId, encodedSecret) {
  await set(ref(getDb(), `games/${roomId}`), {
    secret: encodedSecret,
    createdAt: Date.now(),
    players: {
      host: { done: false, won: false },
    },
  })
}

export async function joinRoom(roomId) {
  const snap = await get(ref(getDb(), `games/${roomId}/players`))
  const existing = snap.val() || {}
  if (Object.keys(existing).length >= 15) return null  // room full
  const playerId = 'g_' + Math.random().toString(36).slice(2, 8)
  await set(ref(getDb(), `games/${roomId}/players/${playerId}`), { done: false, won: false })
  return playerId
}

export function subscribeToRoom(roomId, callback) {
  return onValue(ref(getDb(), `games/${roomId}`), snap => callback(snap.val()))
}

export async function pushPlayerState(roomId, playerId, guesses, clues, done, won) {
  await update(ref(getDb(), `games/${roomId}/players/${playerId}`), { guesses, clues, done, won })
}

function toArray(val) {
  if (!val) return []
  return Array.isArray(val) ? val : Object.values(val)
}

export function parsePlayerData(data) {
  if (!data) return { guesses: [], done: false, won: false }
  const guesses = toArray(data.guesses)
  const clues = toArray(data.clues)
  return {
    guesses: guesses.map((g, i) => ({ guess: g, clues: clues[i] || '' })),
    done: !!data.done,
    won: !!data.won,
  }
}
