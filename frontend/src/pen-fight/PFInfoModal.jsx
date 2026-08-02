export default function PFInfoModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>How to Play — Pen Fight</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p>
            Each player places a pen on their half of the desk, then takes turns flicking
            it at the opponent's pen. Knock your opponent's pen off the desk to win the round!
          </p>

          <ul className="modal-rules" style={{ marginTop: '0.75rem' }}>
            <li><strong>Toss winner</strong> flicks first each round</li>
            <li>Knock the opponent's pen off the desk → you win the round</li>
            <li>Your own pen falls off → you lose that round</li>
            <li>Both pens fall? Tie — the round replays</li>
            <li>Win the most rounds to win the match</li>
          </ul>

          <div style={{ marginTop: '0.85rem' }}>
            <h3 style={{ fontSize: '0.85rem', color: '#818384', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>Controls</h3>
            <ul className="modal-rules">
              <li>
                <strong>Placement:</strong> Tap anywhere in your half to preview your pen's
                position. Use <em>Rotate L / R</em> to change its angle, then tap <em>Place Pen ✓</em> to confirm.
              </li>
              <li>
                <strong>Aiming:</strong> Press and drag on the desk — the white arrow shows
                the exact direction your pen will fly.
              </li>
              <li>
                <strong>Power:</strong> Drag <em>further</em> from where you pressed for more
                power; pull <em>closer</em> to reduce it. The ring fills as power increases.
              </li>
              <li>
                <strong>Shoot:</strong> Release (lift finger or mouse) to flick. Power and
                direction are locked at the moment you release.
              </li>
              <li>
                <strong>Quick tap:</strong> A tiny tap auto-aims straight at the opponent's
                pen with minimum power — useful for nudging.
              </li>
            </ul>
          </div>

          <div className="modal-modes" style={{ marginTop: '0.75rem' }}>
            <h3>Modes</h3>
            <div className="mode-info-row">
              <span className="mode-badge" style={{ background: '#9b59b6' }}>vs Computer</span>
              <span>Play instantly against the CPU. Choose Beginner or Advanced difficulty.</span>
            </div>
            <div className="mode-info-row">
              <span className="mode-badge" style={{ background: '#538d4e' }}>vs Friend</span>
              <span>
                Play online — host creates a room and shares the invite link.
                Each player sees the desk from their own side.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
