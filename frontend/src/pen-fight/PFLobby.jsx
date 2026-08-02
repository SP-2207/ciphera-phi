import { useState } from 'react'

export default function PFLobby({ roomId, players, myPlayerId, onBack }) {
  const COLORS = ['#e74c3c', '#3498db']
  const [copied, setCopied] = useState(false)

  const shareUrl     = `${window.location.origin}${window.location.pathname}#pen-fight/${roomId}`
  const shareMessage =
    `✏️ You've been challenged to Pen Fight!\n` +
    `Flick your pen and knock the opponent's pen off the desk.\n` +
    `Join here: ${shareUrl}`

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

  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share
  function nativeShare() {
    navigator.share({ title: '✏️ Pen Fight Challenge!', text: shareMessage, url: shareUrl }).catch(() => {})
  }

  const waiting = players.length < 2

  return (
    <div className="game">
      <div className="header">
        <div className="header-left">
          <button className="icon-btn" onClick={onBack}>←</button>
        </div>
        <h1>Pen Fight</h1>
        <div className="header-right" />
      </div>

      <div className="db-lobby">
        <p className="db-lobby-status">
          {waiting ? 'Waiting for opponent…' : 'Starting toss…'}
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
            <button className="db-native-share-btn" onClick={nativeShare}>↗ Share</button>
          )}
        </div>

        <div className="db-lobby-players">
          {[0, 1].map(i => {
            const player = players.find(p => p.slot === i)
            return (
              <div key={i} className="db-lobby-player">
                <span className="db-lobby-dot" style={{ background: COLORS[i] }} />
                {player ? (
                  <>
                    <span className="db-lobby-initials">{player.initials}</span>
                    <span className="db-lobby-who">
                      {player.id === myPlayerId ? '(You)' : player.isHost ? '(Host)' : ''}
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
