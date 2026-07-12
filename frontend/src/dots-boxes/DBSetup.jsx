import { useState } from 'react'

export default function DBSetup({ mode, isInvite, joinError, onStart, onBack }) {
  const [playerCount, setPlayerCount] = useState(2)
  const [difficulty,  setDifficulty]  = useState('beginner')
  const [initials,    setInitials]    = useState('')
  const [error,       setError]       = useState('')

  function handleStart() {
    const trimmed = initials.trim().toUpperCase().replace(/[^A-Z]/g, '')
    if (trimmed.length < 1 || trimmed.length > 2) {
      setError('Enter 1–2 letters for your initials')
      return
    }
    setError('')
    onStart({ playerCount, difficulty, initials: trimmed })
  }

  const ctaLabel = isInvite
    ? 'Join Game →'
    : mode === 'computer'
      ? 'Start Game →'
      : 'Create Room →'

  return (
    <div className="game">
      <div className="header">
        <div className="header-left">
          <button className="icon-btn" onClick={onBack}>←</button>
        </div>
        <h1>Dots &amp; Boxes</h1>
        <div className="header-right" />
      </div>

      <div className="db-setup">
        {!isInvite && (
          <div className="db-setup-group">
            <span className="db-setup-label">Players</span>
            <div className="db-setup-row">
              {[2, 3, 4].map(n => (
                <button
                  key={n}
                  type="button"
                  className={`db-chip${playerCount === n ? ' db-chip--active' : ''}`}
                  onClick={() => setPlayerCount(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'computer' && (
          <div className="db-setup-group">
            <span className="db-setup-label">Difficulty</span>
            <div className="db-setup-row">
              {['Beginner', 'Advanced'].map(d => (
                <button
                  key={d}
                  type="button"
                  className={`db-chip${difficulty === d.toLowerCase() ? ' db-chip--active' : ''}`}
                  onClick={() => setDifficulty(d.toLowerCase())}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="db-setup-group">
          <span className="db-setup-label">Your Initials</span>
          <input
            type="text"
            className="db-initials-input"
            placeholder="AB"
            maxLength={2}
            value={initials}
            onChange={e => {
              setInitials(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))
              setError('')
            }}
          />
        </div>

        {(error || joinError) && (
          <p className="db-error">{error || joinError}</p>
        )}

        <button className="accept-btn" onClick={handleStart}>
          {ctaLabel}
        </button>
      </div>
    </div>
  )
}
