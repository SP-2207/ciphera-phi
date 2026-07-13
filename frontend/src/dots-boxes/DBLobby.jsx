import { useState } from 'react'

export default function DBLobby({ roomId, playerCount, players, myPlayerId, onBack }) {
  const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12']
  const [copied, setCopied] = useState(false)

  const shareUrl     = `${window.location.origin}${window.location.pathname}#dots-boxes/${roomId}`
  const shareMessage =
    `⬛ You've been challenged to Dots & Boxes!\n` +
    `Draw lines, claim boxes and outsmart your opponent.\n` +
    `Join here: ${shareUrl}`

  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share

  function copyMessage() {
    navigator.clipboard.writeText(shareMessage).catch(() => {
      const el = document.createElement('textarea')
      el.value = shareMessage
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    })
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  function nativeShare() {
    navigator.share({
      title: '⬛ Dots & Boxes Challenge!',
      text:  shareMessage,
      url:   shareUrl,
    }).catch(() => {})
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
        <p className="db-lobby-status">
          {players.length < playerCount ? 'Waiting for players…' : 'Starting game…'}
        </p>

        <div className="db-lobby-code">{roomId}</div>

        <div className="db-share-box">
          <p className="db-share-preview">{shareMessage}</p>
        </div>

        <div className="db-lobby-btns">
          <button className="db-copy-btn" onClick={copyMessage}>
            {copied ? '✓ Copied!' : '📋 Copy Message'}
          </button>
          {canNativeShare && (
            <button className="db-native-share-btn" onClick={nativeShare}>
              ↗ Share
            </button>
          )}
        </div>

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
