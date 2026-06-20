import { useState, useEffect, useRef } from 'react'
import { DIGITS, MAX_GUESSES, getClues, decodeSecret, encodeClues, decodeClues } from '../utils/gameLogic'
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
          const rawDisplay = active
            ? currentInput.padEnd(DIGITS, ' ')
            : (g?.guess || '').padEnd(DIGITS, ' ')
          const clues = (active || !g) ? Array(DIGITS).fill('') : decodeClues(g.clues || '')
          return (
            <div key={i} className="row">
              {Array.from({ length: DIGITS }, (_, j) => (
                <Cell
                  key={j}
                  digit={isYours ? (rawDisplay[j] === ' ' ? '' : rawDisplay[j]) : ''}
                  clue={clues[j]}
                />
              ))}
            </div>
          )
        })}
      </div>
      {!isYours && guesses.length === 0 && (
        <p className="waiting-msg">Waiting…</p>
      )}
    </div>
  )
}

export default function CompeteBoard({ roomId, playerId, onRestart }) {
  const [secret, setSecret] = useState(null)
  const [myGuesses, setMyGuesses] = useState([])
  const [allPlayers, setAllPlayers] = useState({})
  const [currentInput, setCurrentInput] = useState('')
  const [gameOver, setGameOver] = useState(false)
  const [won, setWon] = useState(false)
  const [error, setError] = useState('')
  const [showInfo, setShowInfo] = useState(false)
  const [copied, setCopied] = useState(false)

  const secretRef = useRef(null)
  const gameOverRef = useRef(false)
  const myGuessesRef = useRef([])
  const currentInputRef = useRef('')
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
      const playersRaw = room.players || {}
      const parsed = {}
      for (const [id, data] of Object.entries(playersRaw)) {
        parsed[id] = parsePlayerData(data)
      }
      setAllPlayers(parsed)
    })
    return unsub
  }, [roomId])

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
      roomId, playerId,
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
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  // Separate my data from opponents
  const opponents = Object.entries(allPlayers).filter(([id]) => id !== playerId)
  const totalPlayers = 1 + opponents.length
  const activeRow = gameOver ? -1 : myGuesses.length
  const anyOppDone = opponents.some(([, p]) => p.done)
  const allDone = gameOver && opponents.every(([, p]) => p.done)

  // Verdict when everyone is done
  let verdict = null
  if (allDone) {
    const entries = [
      { label: 'You', won, count: myGuesses.length },
      ...opponents.map(([, p], i) => ({ label: `Opponent ${i + 1}`, won: p.won, count: p.guesses.length })),
    ]
    const winners = entries.filter(e => e.won)
    if (winners.length === 0) {
      verdict = '🤝 Nobody got it!'
    } else {
      const best = Math.min(...winners.map(e => e.count))
      const top = winners.filter(e => e.count === best)
      if (top.length > 1) verdict = '🤝 Tie!'
      else if (top[0].label === 'You') verdict = winners.length === 1 ? '🏆 You win!' : '🏆 You win by fewer guesses!'
      else verdict = `😔 ${top[0].label} wins!`
    }
  }

  // Share text for all players
  function buildShareText() {
    function section(label, guesses, isWon) {
      const score = isWon ? guesses.length : 'X'
      const rows = guesses.map(({ clues }) =>
        decodeClues(clues).map(c => c === 'correct' ? '🟩' : c === 'present' ? '🟨' : '⬛').join('')
      ).join('\n')
      return `── ${label} (${score}/${MAX_GUESSES}) ──\n${rows}`
    }
    const anyWon = won || opponents.some(([, p]) => p.won)
    const parts = [
      'Number Wordle [Compete]',
      section('You', myGuesses, won),
      ...opponents.map(([, p], i) => section(`Opponent ${i + 1}`, p.guesses, p.won)),
    ]
    return parts.join('\n\n') + (!anyWon ? `\n\nAnswer: ${secret}` : '')
  }

  // Grid column count: 2 players→2 cols, 3→3 cols, 4→2×2
  const cols = totalPlayers <= 2 ? 2 : totalPlayers === 3 ? 3 : 2

  if (!secret) {
    return <div className="game"><p className="loading-msg">Loading game room…</p></div>
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

      <div
        className="compete-layout"
        data-players={totalPlayers}
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        <PlayerGrid
          label="You"
          isYours={true}
          guesses={myGuesses}
          currentInput={currentInput}
          activeRow={activeRow}
        />
        {opponents.map(([id, p], i) => (
          <PlayerGrid
            key={id}
            label={opponents.length === 1 ? 'Opponent' : `Opponent ${i + 1}`}
            isYours={false}
            guesses={p.guesses}
            currentInput=""
            activeRow={-1}
          />
        ))}
      </div>

      {!gameOver && <Keypad onKey={handleKey} />}

      {error && <p className="error">{error}</p>}

      {(gameOver || anyOppDone) && (
        <div className="game-over">
          {gameOver && (won
            ? <p className="win-msg">You got it in {myGuesses.length}! 🎉</p>
            : <p className="lose-msg">You didn't get it — the number was <strong>{secret}</strong></p>
          )}
          {opponents.map(([id, p], i) => p.done && (
            <p key={id} className={`opp-result ${p.won ? 'opp-won' : 'opp-lost'}`}>
              {opponents.length === 1 ? 'Opponent' : `Opponent ${i + 1}`}
              {p.won ? ` got it in ${p.guesses.length}! ⚡` : ` didn't get it`}
            </p>
          ))}
          {verdict && <p className="verdict">{verdict}</p>}
          {!gameOver && <p className="waiting-for-you">Finish your game to see the final result!</p>}
          {gameOver && (
            <div className="game-over-actions">
              <button className="share-btn" onClick={() => copyText(buildShareText())}>
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
