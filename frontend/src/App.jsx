import { useState, useEffect } from 'react'
import ModeSelect from './components/ModeSelect'
import GameBoard from './components/GameBoard'
import './App.css'

export default function App() {
  const [mode, setMode] = useState(null)
  const [competSecret, setCompetSecret] = useState(null)
  const [isInvite, setIsInvite] = useState(false)

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    const match = hash.match(/^compete\/(\d{6})$/)
    if (match) {
      setCompetSecret(match[1])
      setIsInvite(true)
    }
  }, [])

  function handleRestart() {
    setMode(null)
    setCompetSecret(null)
    setIsInvite(false)
    window.location.hash = ''
  }

  if (!mode) {
    return <ModeSelect onSelect={setMode} isInvite={isInvite} />
  }

  return <GameBoard mode={mode} competSecret={competSecret} onRestart={handleRestart} />
}
