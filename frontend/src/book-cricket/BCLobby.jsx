import { useEffect, useState } from 'react'
import { subscribeToBCRoom } from './bcFirebase'

export default function BCLobby({ roomId, format, overs, batsmanOvers, onOpponentJoined, onHome }) {
  const [copied,      setCopied]      = useState(false)
  const [playerCount, setPlayerCount] = useState(1)

  const shareUrl = `${window.location.origin}${window.location.pathname}#book-cricket/${roomId}`

  const shareMessage =
    `🏏 You've been challenged to a Book Cricket match!\n` +
    `Come flip the book and prove your cricket skills.\n` +
    `Join here: ${shareUrl}`

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
    const text = shareMessage
    navigator.clipboard.writeText(text).catch(() => {
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }).finally?.(() => {})
    // Show copied regardless (clipboard API may reject silently)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  function nativeShare() {
    navigator.share({
      title: '🏏 Book Cricket Challenge!',
      text: shareMessage,
      url: shareUrl,
    }).catch(() => {})
  }

  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share

  function formatLabel() {
    if (format === 'test')          return 'Test Match'
    if (format === 'batsman-overs') return `${batsmanOvers} overs per batsman`
    return `${overs}-over match`
  }

  return (
    <div className="game">
      <div className="header">
        <div className="header-left">
          <button className="icon-btn" onClick={onHome}>←</button>
        </div>
        <h1>Book Cricket</h1>
        <div className="header-right">
          <span className="mode-badge" style={{ background: format === 'test' ? '#818384' : '#b59f3b' }}>
            {format === 'test' ? 'Test' : format === 'batsman-overs' ? `${batsmanOvers}ov/bat` : `${overs}ov`}
          </span>
        </div>
      </div>

      <div className="bc-lobby">
        <div className="bc-lobby-icon">🏏</div>

        <div className="bc-lobby-status">
          {playerCount < 2
            ? <><span className="bc-lobby-dot" /><span className="bc-lobby-dot" /><span className="bc-lobby-dot" /></>
            : <span className="bc-lobby-joined">✓ Opponent joined!</span>
          }
        </div>

        <h2 className="bc-lobby-title">
          {playerCount < 2 ? 'Waiting for your opponent…' : 'Starting match…'}
        </h2>
        <p className="bc-lobby-sub">{formatLabel()} · Share this challenge with your friend</p>

        {/* Preview of share message */}
        <div className="bc-share-box">
          <p className="bc-share-preview">{shareMessage}</p>
        </div>

        <div className="bc-lobby-btns">
          <button className="bc-copy-btn" onClick={copyLink}>
            {copied ? '✓ Copied!' : '📋 Copy Message'}
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
