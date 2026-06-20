import { useState, useEffect } from 'react'
import ModeSelect from './components/ModeSelect'
import GameBoard from './components/GameBoard'
import CompeteBoard from './components/CompeteBoard'
import { generateSecret, encodeSecret, generateRoomId } from './utils/gameLogic'
import { createRoom, joinRoom, isFirebaseConfigured } from './utils/firebase'
import './App.css'

export default function App() {
  const [mode, setMode] = useState(null)
  const [playerId, setPlayerId] = useState(null)
  const [roomId, setRoomId] = useState(null)
  const [isInvite, setIsInvite] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    const match = hash.match(/^compete\/([A-Z][A-Z0-9]{5})$/)
    if (match) {
      const foundRoomId = match[1]
      setRoomId(foundRoomId)
      // Same device already joined this room — rejoin directly without creating a new slot
      const saved = localStorage.getItem(`ciphera_compete_${foundRoomId}`)
      if (saved) {
        setPlayerId(saved)
        setMode('compete')
      } else {
        setIsInvite(true)
      }
    }
  }, [])

  async function handleSelectMode(selectedMode) {
    if (selectedMode === 'compete') {
      if (!isFirebaseConfigured()) {
        alert('Firebase is not configured yet. See setup instructions.')
        return
      }
      setCreating(true)
      if (isInvite) {
        try {
          const id = await joinRoom(roomId)
          if (!id) {
            alert('This game room is full (max 4 players).')
            setCreating(false)
            return
          }
          localStorage.setItem(`ciphera_compete_${roomId}`, id)
          setPlayerId(id)
          setMode('compete')
        } catch (err) {
          console.error('joinRoom failed:', err)
          alert('Could not join game room. Check your connection.')
        }
      } else {
        const id = generateRoomId()
        const encoded = encodeSecret(generateSecret())
        try {
          await createRoom(id, encoded)
        } catch (err) {
          console.error('Firebase createRoom failed:', err)
          setCreating(false)
          alert('Could not create game room. Check Firebase setup in Vercel env vars.')
          return
        }
        setRoomId(id)
        setPlayerId('host')
        localStorage.setItem(`ciphera_compete_${id}`, 'host')
        setMode('compete')
      }
      setCreating(false)
    } else {
      setMode(selectedMode)
    }
  }

  function handleRestart() {
    setMode(null)
    setPlayerId(null)
    setRoomId(null)
    setIsInvite(false)
    window.location.hash = ''
  }

  if (!mode || creating) {
    return <ModeSelect onSelect={handleSelectMode} isInvite={isInvite} loading={creating} />
  }

  if (mode === 'compete') {
    return <CompeteBoard roomId={roomId} playerId={playerId} onRestart={handleRestart} />
  }

  return <GameBoard mode={mode} onRestart={handleRestart} />
}
