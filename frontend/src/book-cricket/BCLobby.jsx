import { useEffect, useState } from 'react'
import { subscribeToBCRoom } from './bcFirebase'

export default function BCLobby({ roomId, format, overs, onOpponentJoined, onHome }) {
  const [copied, setCopied] = useState(false)
  const [playerCount, setPlayerCount] = useState(1)

  const shareUrl = `${window.location.origin}${window.location.pathname}#book-cricket/${roomId}`

  // Watch Firebase for guest joining
  useEffect(() => {
    const unsub = subscribeToBCRoom(roomId, room => {
      if (!room?.players) return
      const count = Object.keys(room.players).length
      setPlayerCount(count)
      if (count >= 2) onOpponentJoined()
    })
    return unsub
  }, [roomId]) // eslint-disable-line

  function copyLink() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }).catch(() => {
      // Fallback for browsers without clipboard API
      const el = document.createElement('textarea')
      el.value = shareUrl
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  function nativeShare() {
    navigator.share({
      title: 'Book Cricket',
      text: 'Join me for a Book Cricket match!',
      url: shareUrl,
    }).catch(() => {})
  }

  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share

  const formatLabel = format === 'test'
    ? 'Test Match'
    : `${overs}-over match`

  return (
    <div className="game">
      <div className="header">
        <div className="header-left">
          <button className="icon-btn" onClick={onHome}>←</button>
        </div>
        <h1>Book Cricket</h1>
        <div className="header-right">
          <span className="mode-badge" style={{ background: format === 'test' ? '#818384' : '#b59f3b' }}>
            {format === 'test' ? 'Test' : `${overs}ov`}
          </span>
        </div>
      </div>

      <div className="bc-lobby">
        <div className="bc-lobby-icon">📖</div>

        <div className="bc-lobby-status">
          {playerCount < 2
            ? <><span className="bc-lobby-dot" /><span className="bc-lobby-dot" /><span className="bc-lobby-dot" /></>
            : <span className="bc-lobby-joined">✓ Opponent joined!</span>
          }
        </div>

        <h2 className="bc-lobby-title">
          {playerCount < 2 ? 'Waiting for opponent…' : 'Starting match…'}
        </h2>
        <p className="bc-lobby-sub">{formatLabel} · Share this link with your friend</p>

        <div className="bc-share-box">
          <span className="bc-share-url">{shareUrl}</span>
        </div>

        <div className="bc-lobby-btns">
          <button className="bc-copy-btn" onClick={copyLink}>
            {copied ? '✓ Copied!' : '📋 Copy Link'}
          </button>
          {canNativeShare && (
            <button className="bc-native-share-btn" onClick={nativeShare}>
              ↗ Share
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
