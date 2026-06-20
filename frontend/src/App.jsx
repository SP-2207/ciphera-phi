import { useState, useEffect } from 'react'
import ModeSelect from './components/ModeSelect'
import GameBoard from './components/GameBoard'
import CompeteBoard from './components/CompeteBoard'
import { generateSecret, encodeSecret, generateRoomId } from './utils/gameLogic'
import { createRoom, isFirebaseConfigured } from './utils/firebase'
import './App.css'

export default function App() {
  const [mode, setMode] = useState(null)
  const [role, setRole] = useState(null)
  const [roomId, setRoomId] = useState(null)
  const [isInvite, setIsInvite] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    // Room IDs always start with a letter (A-Z)
    const match = hash.match(/^compete\/([A-Z][A-Z0-9]{5})$/)
    if (match) {
      setRoomId(match[1])
      setIsInvite(true)
    }
  }, [])

  async function handleSelectMode(selectedMode) {
    if (selectedMode === 'compete') {
      if (isInvite) {
        setRole('guest')
        setMode('compete')
      } else {
        if (!isFirebaseConfigured()) {
          alert('Firebase is not configured yet. See setup instructions.')
          return
        }
        setCreating(true)
        const id = generateRoomId()
        const encoded = encodeSecret(generateSecret())
        await createRoom(id, encoded)
        setRoomId(id)
        setRole('host')
        setCreating(false)
        setMode('compete')
      }
    } else {
      setMode(selectedMode)
    }
  }

  function handleRestart() {
    setMode(null)
    setRole(null)
    setRoomId(null)
    setIsInvite(false)
    window.location.hash = ''
  }

  if (!mode) {
    return <ModeSelect onSelect={handleSelectMode} isInvite={isInvite} loading={creating} />
  }

  if (mode === 'compete') {
    return <CompeteBoard roomId={roomId} role={role} onRestart={handleRestart} />
  }

  return <GameBoard mode={mode} onRestart={handleRestart} />
}
