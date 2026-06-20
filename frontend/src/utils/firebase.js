import { initializeApp } from 'firebase/app'
import { getDatabase, ref, set, update, onValue } from 'firebase/database'

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
    const app = initializeApp(firebaseConfig)
    db = getDatabase(app)
  }
  return db
}

export async function createRoom(roomId, encodedSecret) {
  await set(ref(getDb(), `games/${roomId}`), {
    secret: encodedSecret,
    createdAt: Date.now(),
    host:  { guesses: [], clues: [], done: false, won: false },
    guest: { guesses: [], clues: [], done: false, won: false },
  })
}

export function subscribeToRoom(roomId, callback) {
  return onValue(ref(getDb(), `games/${roomId}`), snap => callback(snap.val()))
}

export async function pushPlayerState(roomId, role, guesses, clues, done, won) {
  await update(ref(getDb(), `games/${roomId}/${role}`), { guesses, clues, done, won })
}

function toArray(val) {
  if (!val) return []
  return Array.isArray(val) ? val : Object.values(val)
}

export function parsePlayerData(data) {
  if (!data) return { guesses: [], done: false, won: false }
  return {
    guesses: toArray(data.guesses).map((g, i) => ({
      guess: g,
      clues: toArray(data.clues)[i] || '',
    })),
    done: !!data.done,
    won: !!data.won,
  }
}
