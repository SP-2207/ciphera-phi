import { useState } from 'react'
import InfoModal from './InfoModal'

export default function ModeSelect({ onSelect, isInvite, loading, onHome }) {
  const [showInfo, setShowInfo] = useState(false)

  if (loading) {
    return (
      <div className="game">
        <div className="header">
          <div className="header-left" />
          <h1>Ciphera</h1>
          <div className="header-right" />
        </div>
        <p className="loading-msg">Creating game room…</p>
      </div>
    )
  }

  if (isInvite) {
    return (
      <div className="game">
        <div className="header">
          <div className="header-left">
            {onHome && <button className="icon-btn" onClick={onHome} title="Back to games">←</button>}
          </div>
          <h1>Ciphera</h1>
          <div className="header-right">
            <button className="icon-btn" onClick={() => setShowInfo(true)} title="How to play">?</button>
          </div>
        </div>
        <div className="invite-card">
          <div className="invite-icon">⚔️</div>
          <h2>You've been challenged!</h2>
          <p>A friend invited you to compete on the same puzzle.</p>
          <button className="accept-btn" onClick={() => onSelect('compete')}>
            Accept Challenge
          </button>
        </div>
        {showInfo && <InfoModal onClose={() => setShowInfo(false)} />}
      </div>
    )
  }

  return (
    <div className="game">
      <div className="header">
        <div className="header-left">
          {onHome && <button className="icon-btn" onClick={onHome} title="Back to games">←</button>}
        </div>
        <h1>Ciphera</h1>
        <div className="header-right">
          <button className="icon-btn" onClick={() => setShowInfo(true)} title="How to play">?</button>
        </div>
      </div>

      <p className="mode-subtitle">Choose your game mode</p>
      <div className="mode-cards">
        <button className="mode-card" onClick={() => onSelect('classic')}>
          <span className="mode-icon">🎯</span>
          <span className="mode-text">
            <span className="mode-name">Classic</span>
            <span className="mode-desc">Guess the 6-digit number in 6 tries</span>
          </span>
        </button>
        <button className="mode-card" onClick={() => onSelect('timed')}>
          <span className="mode-icon">⏱️</span>
          <span className="mode-text">
            <span className="mode-name">Timed</span>
            <span className="mode-desc">20 seconds per guess — stay sharp!</span>
          </span>
        </button>
        <button className="mode-card" onClick={() => onSelect('compete')}>
          <span className="mode-icon">⚔️</span>
          <span className="mode-text">
            <span className="mode-name">Compete</span>
            <span className="mode-desc">Challenge a friend to the same puzzle</span>
          </span>
        </button>
      </div>

      {showInfo && <InfoModal onClose={() => setShowInfo(false)} />}
    </div>
  )
}
