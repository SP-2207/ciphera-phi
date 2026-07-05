import { useState, useEffect, useRef } from 'react'
import { newTeamState, applyFlip, getActiveTurn, oversLabel, BOOK_PAGES } from './bcLogic'
import { subscribeToBCRoom, pushBCState, parseBCPlayer } from './bcFirebase'
import BookFlip from './BookFlip'

function BallPill({ entry }) {
  const cls   = entry.wicket ? 'bc-ball--out' : entry.dot ? 'bc-ball--dot' : 'bc-ball--run'
  const label = entry.wicket ? 'W' : entry.dot ? '·' : entry.runs
  return <span className={`bc-ball ${cls}`}>{label}</span>
}

function TeamPanel({ team, label, isYou, isActive }) {
  const overStart     = Math.floor(team.totalBalls / 6) * 6
  const thisOverBalls = team.history.slice(overStart)
  const prevOverBalls = team.history.slice(Math.max(0, overStart - 6), overStart)

  return (
    <div className={`bc-team-panel${isActive ? ' bc-team--active' : ''}`}>
      <div className={`panel-label ${isYou ? 'label-you' : 'label-opp'}`}>{label}</div>

      <div className="bc-score-main">
        <span className="bc-runs">{team.totalRuns}</span>
        <span className="bc-wkt">/{team.wickets}</span>
      </div>
      <div className="bc-overs-line">{oversLabel(team.totalBalls)} ov</div>

      <div className="bc-batsmen">
        {team.batsmen.map((b, i) => (
          <div
            key={i}
            className={`bc-batsman-row${i === team.currentBatsman && !team.done ? ' bc-bat--active' : ''}${b.out ? ' bc-bat--out' : ''}`}
          >
            <span className="bc-bat-name">{b.name}</span>
            <span className="bc-bat-score">{b.runs} <span className="bc-bat-balls">({b.balls}b)</span></span>
            {b.out && <span className="bc-out-tag">out</span>}
          </div>
        ))}
      </div>

      {thisOverBalls.length > 0 && (
        <div className="bc-over-row">
          <span className="bc-over-title">This over</span>
          <div className="bc-balls">
            {thisOverBalls.map((b, i) => <BallPill key={i} entry={b} />)}
          </div>
        </div>
      )}

      {prevOverBalls.length > 0 && thisOverBalls.length === 0 && (
        <div className="bc-over-row">
          <span className="bc-over-title">Last over</span>
          <div className="bc-balls">
            {prevOverBalls.map((b, i) => <BallPill key={i} entry={b} />)}
          </div>
        </div>
      )}

      {team.done && <div className="bc-innings-done">Innings complete</div>}
    </div>
  )
}

export default function BCGame({
  format, overs, opponent,
  roomId, playerId, isHost,
  myBatsmenNames,
  onGameOver, onHome,
}) {
  const [myTeam,  setMyTeam]  = useState(() => newTeamState(myBatsmenNames))
  const [oppTeam, setOppTeam] = useState(() => newTeamState())
  const [compFlipping, setCompFlipping] = useState(false)

  const myTeamRef   = useRef(myTeam)
  const oppTeamRef  = useRef(oppTeam)
  const compThinkRef = useRef(null)   // timer for computer "thinking" delay

  useEffect(() => { myTeamRef.current  = myTeam  }, [myTeam])
  useEffect(() => { oppTeamRef.current = oppTeam }, [oppTeam])

  const maxBalls = format === 'limited' ? overs * 6 : Infinity

  // Firebase subscription (friend mode)
  useEffect(() => {
    if (opponent !== 'friend' || !roomId) return
    const unsub = subscribeToBCRoom(roomId, room => {
      if (!room?.players) return
      const oppId = Object.keys(room.players).find(id => id !== playerId)
      if (!oppId) return
      const parsed = parseBCPlayer(room.players[oppId])
      if (parsed) setOppTeam(parsed)
    })
    return unsub
  }, [roomId, playerId, opponent])

  // Whose turn
  const hostTeam  = isHost ? myTeam  : oppTeam
  const guestTeam = isHost ? oppTeam : myTeam
  const turnIdx   = getActiveTurn(hostTeam, guestTeam)
  const isMyTurn  = turnIdx === null ? false : isHost ? turnIdx === 0 : turnIdx === 1
  const gameOver  = myTeam.done && oppTeam.done

  // Computer auto-flip after thinking delay
  useEffect(() => {
    if (opponent !== 'computer') return
    if (gameOver || isMyTurn || oppTeam.done || compFlipping) return
    compThinkRef.current = setTimeout(() => setCompFlipping(true), 1100)
    return () => clearTimeout(compThinkRef.current)
  }, [opponent, gameOver, isMyTurn, oppTeam.done, compFlipping, oppTeam.totalBalls])

  // Notify parent when game ends
  useEffect(() => {
    if (!gameOver) return
    const t = setTimeout(() => onGameOver(myTeam, oppTeam, isHost), 700)
    return () => clearTimeout(t)
  }, [gameOver]) // eslint-disable-line

  // ── Flip handlers ──────────────────────────────────
  function handleMyFlip(page) {
    const next = applyFlip(myTeamRef.current, page, maxBalls)
    setMyTeam(next)
    if (opponent === 'friend') pushBCState(roomId, playerId, next)
  }

  function handleCompFlip(page) {
    const next = applyFlip(oppTeamRef.current, page, maxBalls)
    setOppTeam(next)
    setCompFlipping(false)
  }

  // ── Skip controls (computer only) ──────────────────
  function skipBall() {
    clearTimeout(compThinkRef.current)
    setCompFlipping(false)
    const page = Math.floor(Math.random() * BOOK_PAGES) + 1
    const next = applyFlip(oppTeamRef.current, page, maxBalls)
    setOppTeam(next)
  }

  function skipOver() {
    clearTimeout(compThinkRef.current)
    setCompFlipping(false)
    let team = oppTeamRef.current
    if (team.done) return
    const ballsInOver = team.totalBalls % 6
    const ballsLeft   = ballsInOver === 0 ? 6 : (6 - ballsInOver)
    for (let i = 0; i < ballsLeft; i++) {
      if (team.done) break
      team = applyFlip(team, Math.floor(Math.random() * BOOK_PAGES) + 1, maxBalls)
    }
    setOppTeam(team)
  }

  const oppLabel = opponent === 'computer' ? 'Computer' : 'Opponent'
  const target   = oppTeam.done && !myTeam.done ? oppTeam.totalRuns + 1 : null

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

      <div className="bc-panels">
        <TeamPanel team={myTeam}  label="You"     isYou={true}  isActive={isMyTurn  && !gameOver} />
        <TeamPanel team={oppTeam} label={oppLabel} isYou={false} isActive={!isMyTurn && !gameOver} />
      </div>

      {!gameOver && (
        <div className="bc-action">
          {target && <p className="bc-target">Target: <strong>{target}</strong></p>}

          {/* Player's flip */}
          {isMyTurn && !myTeam.done && (
            <BookFlip key={myTeam.totalBalls} onResult={handleMyFlip} />
          )}

          {/* Computer's turn */}
          {!isMyTurn && opponent === 'computer' && !oppTeam.done && (
            <>
              {compFlipping
                ? <BookFlip key={`c${oppTeam.totalBalls}`} onResult={handleCompFlip} autoStart />
                : <p className="bc-waiting">
                    {myTeam.done ? 'Computer batting…' : 'Computer thinking…'}
                  </p>
              }
              <div className="bc-skip-controls">
                <button className="bc-skip-ball-btn" onClick={skipBall}>⏭ Skip Ball</button>
                <button className="bc-skip-over-btn" onClick={skipOver}>⏭⏭ Skip Over</button>
              </div>
            </>
          )}

          {/* Friend's turn */}
          {!isMyTurn && opponent === 'friend' && !oppTeam.done && (
            <p className="bc-waiting">Waiting for opponent to flip…</p>
          )}

          {/* Innings done, watching friend */}
          {myTeam.done && !oppTeam.done && opponent === 'friend' && (
            <p className="bc-waiting">Your innings complete — waiting for opponent…</p>
          )}
        </div>
      )}

      {gameOver && <p className="bc-waiting" style={{ marginTop: '1rem' }}>Calculating result…</p>}
    </div>
  )
}
