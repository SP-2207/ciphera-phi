export default function ModeSelect({ onSelect, isInvite, loading }) {
  if (loading) {
    return (
      <div className="mode-select">
        <h1>Ciphera</h1>
        <p className="mode-subtitle">Creating game room…</p>
      </div>
    )
  }
  if (isInvite) {
    return (
      <div className="mode-select">
        <h1>Ciphera</h1>
        <div className="invite-card">
          <div className="invite-icon">⚔️</div>
          <h2>You've been challenged!</h2>
          <p>A friend invited you to compete on the same puzzle.</p>
          <button className="accept-btn" onClick={() => onSelect('compete')}>
            Accept Challenge
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mode-select">
      <h1>Ciphera</h1>
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
    </div>
  )
}
