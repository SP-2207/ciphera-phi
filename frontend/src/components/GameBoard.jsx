import { useState, useEffect, useRef } from 'react'
import { DIGITS, MAX_GUESSES, generateSecret, getClues, buildShareText } from '../utils/gameLogic'
import Keypad from './Keypad'
import InfoModal from './InfoModal'
import Timer from './Timer'

function Cell({ digit, clue }) {
  return <div className={`cell ${clue || ''}`}>{digit}</div>
}

function Row({ guess, clues, isActive, currentInput }) {
  const display = isActive
    ? currentInput.padEnd(DIGITS, ' ')
    : (guess || '').padEnd(DIGITS, ' ')
  const displayClues = clues || Array(DIGITS).fill('')

  return (
    <div className="row">
      {Array.from({ length: DIGITS }, (_, i) => (
        <Cell
          key={i}
          digit={display[i] === ' ' ? '' : display[i]}
          clue={isActive ? '' : displayClues[i]}
        />
      ))}
    </div>
  )
}

export default function GameBoard({ mode, competSecret, onRestart }) {
  const [secret] = useState(() => competSecret || generateSecret())
  const [guesses, setGuesses] = useState([])
  const [currentInput, setCurrentInput] = useState('')
  const [gameOver, setGameOver] = useState(false)
  const [won, setWon] = useState(false)
  const [error, setError] = useState('')
  const [showInfo, setShowInfo] = useState(false)
  const [timerKey, setTimerKey] = useState(0)
  const [shareLink, setShareLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [autoNotice, setAutoNotice] = useState(false)

  // Refs to avoid stale closures in timer/keyboard callbacks
  const guessesRef = useRef([])
  const gameOverRef = useRef(false)
  const lastSubmittedRef = useRef('')
  const currentInputRef = useRef('')

  useEffect(() => { guessesRef.current = guesses }, [guesses])
  useEffect(() => { gameOverRef.current = gameOver }, [gameOver])
  useEffect(() => { currentInputRef.current = currentInput }, [currentInput])

  useEffect(() => {
    function onKeyDown(e) {
      if (gameOverRef.current) return
      if (e.key >= '0' && e.key <= '9') {
        if (currentInputRef.current.length < DIGITS) {
          setCurrentInput(v => v + e.key)
          setError('')
        }
      } else if (e.key === 'Backspace') {
        setCurrentInput(v => v.slice(0, -1))
        setError('')
      } else if (e.key === 'Enter') {
        const inp = currentInputRef.current
        if (inp.length === DIGITS) {
          doSubmit(inp)
        } else {
          setError(`Enter all ${DIGITS} digits first`)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, []) // refs keep this fresh without re-subscribing

  useEffect(() => {
    if (mode === 'compete') {
      const link = `${window.location.origin}${window.location.pathname}#compete/${secret}`
      setShareLink(link)
      window.location.hash = `compete/${secret}`
    }
  }, [])

  function doSubmit(g) {
    if (gameOverRef.current) return
    const current = guessesRef.current
    const clues = getClues(secret, g)
    const next = [...current, { guess: g, clues }]
    lastSubmittedRef.current = g
    setGuesses(next)
    setCurrentInput('')
    setError('')
    setTimerKey(k => k + 1)
    if (g === secret) {
      setWon(true)
      setGameOver(true)
      gameOverRef.current = true
    } else if (next.length >= MAX_GUESSES) {
      setGameOver(true)
      gameOverRef.current = true
    }
  }

  function handleTimerExpire() {
    if (gameOverRef.current) return
    const prev = lastSubmittedRef.current
    if (prev) {
      setAutoNotice(true)
      setTimeout(() => setAutoNotice(false), 2000)
      doSubmit(prev)
    } else {
      setError("Time's up! Start guessing.")
      setTimerKey(k => k + 1)
    }
  }

  function handleKey(key) {
    if (gameOver) return
    setError('')
    if (key === '⌫') {
      setCurrentInput(v => v.slice(0, -1))
    } else if (key === '✓') {
      if (currentInput.length !== DIGITS) {
        setError(`Enter all ${DIGITS} digits first`)
        return
      }
      doSubmit(currentInput)
    } else if (currentInput.length < DIGITS) {
      setCurrentInput(v => v + key)
    }
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard not available */
    }
  }

  const activeRow = gameOver ? -1 : guesses.length

  return (
    <div className="game">
      <div className="header">
        <div className="header-left">
          <button className="icon-btn" onClick={onRestart} title="Change mode">←</button>
        </div>
        <h1>Number Wordle</h1>
        <div className="header-right">
          <span className={`mode-badge ${mode}`}>{mode}</span>
          <button className="icon-btn info-btn" onClick={() => setShowInfo(true)} title="How to play">
            ?
          </button>
        </div>
      </div>

      {mode === 'compete' && shareLink && !gameOver && (
        <div className="share-banner">
          <span>Invite a friend to this puzzle:</span>
          <button className="copy-link-btn" onClick={() => copyToClipboard(shareLink)}>
            {copied ? '✓ Copied!' : '🔗 Copy Link'}
          </button>
        </div>
      )}

      {mode === 'timed' && !gameOver && (
        <Timer duration={15} onExpire={handleTimerExpire} resetKey={timerKey} />
      )}

      {autoNotice && (
        <div className="auto-notice">⏱ Previous guess auto-submitted!</div>
      )}

      <div className="grid">
        {Array.from({ length: MAX_GUESSES }, (_, i) => {
          const g = guesses[i]
          return (
            <Row
              key={i}
              guess={g?.guess}
              clues={g?.clues}
              isActive={i === activeRow}
              currentInput={currentInput}
            />
          )
        })}
      </div>

      {!gameOver && <Keypad onKey={handleKey} />}

      {error && <p className="error">{error}</p>}

      {gameOver && (
        <div className="game-over">
          {won
            ? <p className="win-msg">You got it in {guesses.length}! 🎉</p>
            : <p className="lose-msg">The number was <strong>{secret}</strong></p>
          }
          <div className="game-over-actions">
            <button
              className="share-btn"
              onClick={() => copyToClipboard(buildShareText(guesses, won, secret, mode))}
            >
              {copied ? '✓ Copied!' : '📋 Share Result'}
            </button>
            <button className="restart-btn" onClick={onRestart}>
              Play Again
            </button>
          </div>
          {mode === 'compete' && (
            <p className="compete-note">
              Share your result with your opponent to compare scores!
            </p>
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
