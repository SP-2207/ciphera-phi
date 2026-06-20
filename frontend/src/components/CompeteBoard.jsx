import { useState, useEffect, useRef } from 'react'
import { DIGITS, MAX_GUESSES, getClues, decodeSecret, encodeClues, decodeClues, buildShareText } from '../utils/gameLogic'
import { subscribeToRoom, pushPlayerState, parsePlayerData } from '../utils/firebase'
import Keypad from './Keypad'
import InfoModal from './InfoModal'

function Cell({ digit, clue }) {
  return <div className={`cell ${clue || ''}`}>{digit}</div>
}

function PlayerGrid({ label, isYours, guesses, currentInput, activeRow }) {
  return (
    <div className="compete-panel">
      <div className={`panel-label ${isYours ? 'label-you' : 'label-opp'}`}>{label}</div>
      <div className="grid">
        {Array.from({ length: MAX_GUESSES }, (_, i) => {
          const g = guesses[i]
          const active = isYours && i === activeRow
          const display = active
            ? currentInput.padEnd(DIGITS, ' ')
            : (g?.guess || '').padEnd(DIGITS, ' ')
          const clues = active ? Array(DIGITS).fill('') : decodeClues(g?.clues || '')
          return (
            <div key={i} className="row">
              {Array.from({ length: DIGITS }, (_, j) => (
                <Cell key={j} digit={display[j] === ' ' ? '' : display[j]} clue={clues[j]} />
              ))}
            </div>
          )
        })}
      </div>
      {!isYours && guesses.length === 0 && (
        <p className="waiting-msg">Waiting for opponent…</p>
      )}
    </div>
  )
}

export default function CompeteBoard({ roomId, role, onRestart }) {
  const [secret, setSecret] = useState(null)
  const [myGuesses, setMyGuesses] = useState([])
  const [oppGuesses, setOppGuesses] = useState([])
  const [currentInput, setCurrentInput] = useState('')
  const [gameOver, setGameOver] = useState(false)
  const [won, setWon] = useState(false)
  const [oppDone, setOppDone] = useState(false)
  const [oppWon, setOppWon] = useState(false)
  const [error, setError] = useState('')
  const [showInfo, setShowInfo] = useState(false)
  const [copied, setCopied] = useState(false)

  const secretRef = useRef(null)
  const gameOverRef = useRef(false)
  const myGuessesRef = useRef([])
  const currentInputRef = useRef('')
  const oppRole = role === 'host' ? 'guest' : 'host'
  const shareLink = `${window.location.origin}${window.location.pathname}#compete/${roomId}`

  useEffect(() => { myGuessesRef.current = myGuesses }, [myGuesses])
  useEffect(() => { gameOverRef.current = gameOver }, [gameOver])
  useEffect(() => { currentInputRef.current = currentInput }, [currentInput])

  useEffect(() => {
    window.location.hash = `compete/${roomId}`
    const unsub = subscribeToRoom(roomId, room => {
      if (!room) return
      if (!secretRef.current && room.secret) {
        const s = decodeSecret(room.secret)
        if (s) { secretRef.current = s; setSecret(s) }
      }
      const opp = parsePlayerData(room[oppRole])
      setOppGuesses(opp.guesses)
      setOppDone(opp.done)
      setOppWon(opp.won)
    })
    return unsub
  }, [roomId, oppRole])

  useEffect(() => {
    function onKeyDown(e) {
      if (gameOverRef.current || !secretRef.current) return
      if (e.key >= '0' && e.key <= '9') {
        if (currentInputRef.current.length < DIGITS) {
          setCurrentInput(v => v + e.key); setError('')
        }
      } else if (e.key === 'Backspace') {
        setCurrentInput(v => v.slice(0, -1)); setError('')
      } else if (e.key === 'Enter') {
        const inp = currentInputRef.current
        inp.length === DIGITS ? doSubmit(inp) : setError(`Enter all ${DIGITS} digits first`)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function doSubmit(g) {
    if (gameOverRef.current || !secretRef.current) return
    const current = myGuessesRef.current
    const clues = getClues(secretRef.current, g)
    const next = [...current, { guess: g, clues: encodeClues(clues) }]
    const isWin = g === secretRef.current
    const isDone = isWin || next.length >= MAX_GUESSES

    setMyGuesses(next)
    setCurrentInput('')
    setError('')
    if (isWin) { setWon(true); setGameOver(true); gameOverRef.current = true }
    else if (next.length >= MAX_GUESSES) { setGameOver(true); gameOverRef.current = true }

    pushPlayerState(
      roomId, role,
      next.map(r => r.guess),
      next.map(r => r.clues),
      isDone, isWin
    )
  }

  function handleKey(key) {
    if (gameOver || !secret) return
    setError('')
    if (key === '⌫') setCurrentInput(v => v.slice(0, -1))
    else if (key === '✓') {
      currentInput.length === DIGITS ? doSubmit(currentInput) : setError(`Enter all ${DIGITS} digits first`)
    } else if (currentInput.length < DIGITS) {
      setCurrentInput(v => v + key)
    }
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {}
  }

  const activeRow = gameOver ? -1 : myGuesses.length
  const bothDone = gameOver && oppDone

  if (!secret) {
    return <div className="game"><p className="loading-msg">Loading game room…</p></div>
  }

  // Decode my guesses for share text (need full clue arrays)
  const myGuessesDecoded = myGuesses.map(g => ({
    guess: g.guess,
    clues: decodeClues(g.clues),
  }))

  let verdict = null
  if (bothDone) {
    if (won && !oppWon) verdict = '🏆 You win!'
    else if (!won && oppWon) verdict = '😔 Opponent wins!'
    else if (won && oppWon)
      verdict = myGuesses.length < oppGuesses.length ? '🏆 You win by fewer guesses!'
              : myGuesses.length > oppGuesses.length ? '😔 Opponent wins by fewer guesses!'
              : '🤝 Tie game!'
    else verdict = '🤝 Neither player got it!'
  }

  return (
    <div className="game">
      <div className="header">
        <div className="header-left">
          <button className="icon-btn" onClick={onRestart} title="Change mode">←</button>
        </div>
        <h1>Number Wordle</h1>
        <div className="header-right">
          <span className="mode-badge compete">compete</span>
          <button className="icon-btn info-btn" onClick={() => setShowInfo(true)} title="How to play">?</button>
        </div>
      </div>

      {!gameOver && (
        <div className="share-banner">
          <span>Invite a friend:</span>
          <button className="copy-link-btn" onClick={() => copyText(shareLink)}>
            {copied ? '✓ Copied!' : '🔗 Copy Link'}
          </button>
        </div>
      )}

      <div className="compete-layout">
        <PlayerGrid
          label="You"
          isYours={true}
          guesses={myGuesses}
          currentInput={currentInput}
          activeRow={activeRow}
        />
        <PlayerGrid
          label="Opponent"
          isYours={false}
          guesses={oppGuesses}
          currentInput=""
          activeRow={-1}
        />
      </div>

      {!gameOver && <Keypad onKey={handleKey} />}

      {error && <p className="error">{error}</p>}

      {(gameOver || oppDone) && (
        <div className="game-over">
          {gameOver && (won
            ? <p className="win-msg">You got it in {myGuesses.length}! 🎉</p>
            : <p className="lose-msg">You didn't get it — the number was <strong>{secret}</strong></p>
          )}
          {oppDone && (oppWon
            ? <p className="opp-result opp-won">Opponent got it in {oppGuesses.length}! ⚡</p>
            : <p className="opp-result opp-lost">Opponent didn't get it either</p>
          )}
          {verdict && <p className="verdict">{verdict}</p>}
          {!gameOver && <p className="waiting-for-you">Finish your game to see the final result!</p>}
          {gameOver && (
            <div className="game-over-actions">
              <button className="share-btn" onClick={() => copyText(buildShareText(myGuessesDecoded, won, secret, 'compete'))}>
                {copied ? '✓ Copied!' : '📋 Share Result'}
              </button>
              <button className="restart-btn" onClick={onRestart}>Play Again</button>
            </div>
          )}
        </div>
      )}

      <div className="legend">
        <span className="legend-item correct">Right position</span>
        <span className="legend-item present">Wrong position</span>
        <span className="legend-item absent">Not in number</span>
      </div>

      {showInfo && <InfoModal onClose={() => setShowInfo(false)} />}
    </div>
  )
}
