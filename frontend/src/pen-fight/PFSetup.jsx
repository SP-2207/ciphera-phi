import { useState } from 'react'
import { ROUNDS_OPTIONS } from './pfLogic'
import PFInfoModal from './PFInfoModal'

export default function PFSetup({ mode, isInvite, joinError, onStart, onBack }) {
  const [rounds,     setRounds]     = useState(3)
  const [difficulty, setDifficulty] = useState('beginner')
  const [initials,   setInitials]   = useState('')
  const [showInfo,   setShowInfo]   = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    const val = initials.trim().slice(0, 4).toUpperCase()
    if (!val) return
    onStart({ rounds, difficulty, initials: val })
  }

  return (
    <div className="game">
      {showInfo && <PFInfoModal onClose={() => setShowInfo(false)} />}
      <div className="header">
        <div className="header-left">
          <button className="icon-btn" onClick={onBack}>←</button>
        </div>
        <h1>Pen Fight</h1>
        <div className="header-right">
          <button className="icon-btn" onClick={() => setShowInfo(true)}>?</button>
        </div>
      </div>

      <form className="db-setup" onSubmit={handleSubmit}>

        <div className="db-setup-group">
          <span className="db-setup-label">Your initials</span>
          <input
            type="text"
            className="db-initials-input"
            style={{ fontSize: '1rem', maxWidth: '160px', letterSpacing: '0.08em' }}
            placeholder="e.g. RS"
            value={initials}
            maxLength={4}
            onChange={e => setInitials(e.target.value.toUpperCase())}
            autoFocus
          />
        </div>

        {/* Rounds — hidden when joining as guest */}
        {!isInvite && (
          <div className="db-setup-group">
            <span className="db-setup-label">Match format</span>
            <div className="db-setup-row">
              {ROUNDS_OPTIONS.map(r => (
                <button
                  key={r}
                  type="button"
                  className={`db-chip${rounds === r ? ' db-chip--active' : ''}`}
                  onClick={() => setRounds(r)}
                >
                  Best of {r}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Difficulty — computer mode only */}
        {mode === 'computer' && (
          <div className="db-setup-group">
            <span className="db-setup-label">Difficulty</span>
            <div className="db-setup-row">
              {['beginner', 'advanced'].map(d => (
                <button
                  key={d}
                  type="button"
                  className={`db-chip${difficulty === d ? ' db-chip--active' : ''}`}
                  onClick={() => setDifficulty(d)}
                >
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

        {joinError && <p className="db-error">{joinError}</p>}

        <button className="accept-btn" type="submit" style={{ marginTop: '0.5rem' }}>
          {isInvite ? 'Join Game →' : mode === 'computer' ? 'Play vs CPU →' : 'Create Room →'}
        </button>
      </form>
    </div>
  )
}
