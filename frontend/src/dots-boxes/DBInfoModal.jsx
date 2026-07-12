export default function DBInfoModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>How to Play — Dots &amp; Boxes</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p>
            Take turns drawing lines between adjacent dots. Complete a box (all 4 sides)
            to claim it and earn a <strong>bonus turn</strong>!
          </p>

          <ul className="modal-rules" style={{ marginTop: '0.75rem' }}>
            <li>Choose grid size at setup: 4×4 up to 14×14 cells</li>
            <li>Draw one line per turn (horizontal or vertical)</li>
            <li>Complete a box → you claim it + get an extra turn</li>
            <li>Player with the most boxes at the end wins</li>
            <li>Ties are shared — all tied players win</li>
          </ul>

          <div className="modal-modes" style={{ marginTop: '0.75rem' }}>
            <h3>Modes</h3>
            <div className="mode-info-row">
              <span className="mode-badge" style={{ background: '#5865f2' }}>vs Computer</span>
              <span>2–4 players (1 human + 1–3 bots). Choose Beginner or Advanced difficulty.</span>
            </div>
            <div className="mode-info-row">
              <span className="mode-badge" style={{ background: '#538d4e' }}>vs Friend</span>
              <span>
                Play online with 2–4 humans. Host creates a room and shares the invite link.
                If a player takes too long, anyone can skip their turn after 30 seconds.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
