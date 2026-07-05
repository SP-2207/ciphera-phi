import { useState } from 'react'
import BCInfoModal from './BCInfoModal'

export default function BCHome({ onSelect, onHome }) {
  const [showInfo, setShowInfo] = useState(false)

  return (
    <div className="game">
      <div className="header">
        <div className="header-left">
          <button className="icon-btn" onClick={onHome} title="Back to games">←</button>
        </div>
        <h1>Book Cricket</h1>
        <div className="header-right">
          <button className="icon-btn" onClick={() => setShowInfo(true)} title="How to play">?</button>
        </div>
      </div>

      <p className="mode-subtitle">Choose how to play</p>
      <div className="mode-cards">
        <button className="mode-card" onClick={() => onSelect('computer')}>
          <span className="mode-icon">🖥️</span>
          <span className="mode-text">
            <span className="mode-name">vs Computer</span>
            <span className="mode-desc">Flip against the CPU — instant opponent</span>
          </span>
        </button>
        <button className="mode-card" onClick={() => onSelect('friend')}>
          <span className="mode-icon">👥</span>
          <span className="mode-text">
            <span className="mode-name">vs Friend</span>
            <span className="mode-desc">Share a link and compete live</span>
          </span>
        </button>
      </div>

      {showInfo && <BCInfoModal onClose={() => setShowInfo(false)} />}
    </div>
  )
}
