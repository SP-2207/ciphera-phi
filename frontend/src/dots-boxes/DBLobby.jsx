export default function DBLobby({ roomId, playerCount, players, myPlayerId, onBack }) {
  const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12']

  function copyInvite() {
    const url =
      window.location.origin +
      window.location.pathname +
      `#dots-boxes/${roomId}`
    navigator.clipboard.writeText(url).catch(() => {})
  }

  return (
    <div className="game">
      <div className="header">
        <div className="header-left">
          <button className="icon-btn" onClick={onBack}>←</button>
        </div>
        <h1>Dots &amp; Boxes</h1>
        <div className="header-right" />
      </div>

      <div className="db-lobby">
        <p className="db-lobby-status">Waiting for players…</p>

        <div className="db-lobby-code">{roomId}</div>

        <button className="accept-btn" style={{ marginBottom: '1.5rem' }} onClick={copyInvite}>
          Copy Invite Link
        </button>

        <div className="db-lobby-players">
          {Array.from({ length: playerCount }, (_, i) => {
            const player = players.find(p => p.slot === i)
            return (
              <div key={i} className="db-lobby-player">
                <span
                  className="db-lobby-dot"
                  style={{ background: COLORS[i] || '#888' }}
                />
                {player ? (
                  <>
                    <span className="db-lobby-initials">{player.initials}</span>
                    <span className="db-lobby-who">
                      {player.id === myPlayerId
                        ? '(You)'
                        : player.isHost
                          ? '(Host)'
                          : ''}
                    </span>
                  </>
                ) : (
                  <span className="db-lobby-who">Waiting…</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
