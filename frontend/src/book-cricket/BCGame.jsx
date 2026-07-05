import { useState, useEffect, useRef } from 'react'
import { newTeamState, applyFlip, getActiveTurn, oversLabel, getOverHistory, BOOK_PAGES } from './bcLogic'
import { subscribeToBCRoom, pushBCState, parseBCPlayer } from './bcFirebase'
import BookFlip from './BookFlip'
import BCInfoModal from './BCInfoModal'

function BallPill({ entry }) {
  let cls, label
  if (entry.wicket)               { cls = 'bc-ball--out';     label = 'W'        }
  else if (entry.extraType==='nb') { cls = 'bc-ball--nb';     label = 'NB'       }
  else if (entry.extraType==='wd') { cls = 'bc-ball--wd';     label = 'WD'       }
  else if (entry.dot)             { cls = 'bc-ball--dot';     label = '·'        }
  else if (entry.runs < 0)        { cls = 'bc-ball--penalty'; label = entry.runs }
  else                            { cls = 'bc-ball--run';     label = entry.runs }
  return <span className={`bc-ball ${cls}`}>{label}</span>
}

function TeamPanel({ team, label, isYou, isActive, isBOMode, batsmanOvers }) {
  const { thisOver, prevOver } = getOverHistory(team.history, team.totalBalls)
  const extraRuns = (team.nbRuns || 0) + (team.wdRuns || 0)

  return (
    <div className={`bc-team-panel${isActive ? ' bc-team--active' : ''}`}>
      <div className={`panel-label ${isYou ? 'label-you' : 'label-opp'}`}>{label}</div>

      <div className="bc-score-main">
        <span className="bc-runs">{team.totalRuns}</span>
        {!isBOMode && <span className="bc-wkt">/{team.wickets}</span>}
      </div>
      <div className="bc-overs-line">{oversLabel(team.totalBalls)} ov</div>

      <div className="bc-batsmen">
        {team.batsmen.map((b, i) => {
          const isActiveBat = i === team.currentBatsman && !team.done
          return (
            <div key={i} className={`bc-batsman-row${isActiveBat ? ' bc-bat--active' : ''}${b.out ? ' bc-bat--out' : ''}`}>
              <span className="bc-bat-name">{b.name}</span>
              <span className="bc-bat-score">
                {b.runs}
                {' '}<span className="bc-bat-balls">
                  ({b.balls}b{isBOMode ? ` · ${oversLabel(b.balls)}/${batsmanOvers}ov` : ''})
                </span>
              </span>
              {b.out && <span className="bc-out-tag">out</span>}
            </div>
          )
        })}
      </div>

      {extraRuns > 0 && (
        <div className="bc-extras-row">
          <span className="bc-extras-label">Extras</span>
          <span className="bc-extras-val">
            {extraRuns}
            {' '}<span className="bc-bat-balls">
              ({[
                (team.nbRuns || 0) > 0 && `NB ${team.nbRuns}`,
                (team.wdRuns || 0) > 0 && `WD ${team.wdRuns}`,
              ].filter(Boolean).join(', ')})
            </span>
          </span>
        </div>
      )}

      {thisOver.length > 0 && (
        <div className="bc-over-row">
          <span className="bc-over-title">This over</span>
          <div className="bc-balls">
            {thisOver.map((b, i) => <BallPill key={i} entry={b} />)}
          </div>
        </div>
      )}
      {thisOver.length === 0 && prevOver.length > 0 && (
        <div className="bc-over-row">
          <span className="bc-over-title">Last over</span>
          <div className="bc-balls">
            {prevOver.map((b, i) => <BallPill key={i} entry={b} />)}
          </div>
        </div>
      )}

      {team.done && <div className="bc-innings-done">Innings complete</div>}
    </div>
  )
}

export default function BCGame({
  format, overs, batsmanOvers, batsmanCount,
  opponent, roomId, playerId, isHost,
  myBatsmenNames,
  initialMyTeam, initialOppTeam,
  onGameOver, onHome,
  onTeamUpdate,
}) {
  const isBOMode = format === 'batsman-overs'
  const maxBalls = format === 'limited' ? overs * 6 : Infinity
  const boParam  = isBOMode ? batsmanOvers : null

  const [myTeam,       setMyTeam]       = useState(() => initialMyTeam  || newTeamState(myBatsmenNames, batsmanCount))
  const [oppTeam,      setOppTeam]      = useState(() => initialOppTeam || newTeamState([], batsmanCount))
  const [compFlipping, setCompFlipping] = useState(false)
  const [showInfo,     setShowInfo]     = useState(false)

  const myTeamRef    = useRef(myTeam)
  const oppTeamRef   = useRef(oppTeam)
  const compThinkRef = useRef(null)

  useEffect(() => { myTeamRef.current  = myTeam  }, [myTeam])
  useEffect(() => { oppTeamRef.current = oppTeam }, [oppTeam])

  // Notify parent of state changes (for computer-mode persistence)
  useEffect(() => { onTeamUpdate?.(myTeam, oppTeam) }, [myTeam, oppTeam]) // eslint-disable-line

  // Push initial state so opponent sees correct names/count from the start
  useEffect(() => {
    if (opponent !== 'friend' || !roomId) return
    pushBCState(roomId, playerId, myTeamRef.current)
  }, []) // eslint-disable-line

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

  // Computer auto-flip
  useEffect(() => {
    if (opponent !== 'computer') return
    if (gameOver || isMyTurn || oppTeam.done || compFlipping) return
    compThinkRef.current = setTimeout(() => setCompFlipping(true), 1100)
    return () => clearTimeout(compThinkRef.current)
  }, [opponent, gameOver, isMyTurn, oppTeam.done, compFlipping, oppTeam.history.length])

  // Game-over callback
  useEffect(() => {
    if (!gameOver) return
    const t = setTimeout(() => onGameOver(myTeam, oppTeam), 700)
    return () => clearTimeout(t)
  }, [gameOver]) // eslint-disable-line

  function handleMyFlip(page) {
    const next = applyFlip(myTeamRef.current, page, maxBalls, boParam)
    setMyTeam(next)
    if (opponent === 'friend') pushBCState(roomId, playerId, next)
  }

  function handleCompFlip(page) {
    const next = applyFlip(oppTeamRef.current, page, maxBalls, boParam)
    setOppTeam(next)
    setCompFlipping(false)
  }

  function skipBall() {
    clearTimeout(compThinkRef.current)
    setCompFlipping(false)
    const next = applyFlip(oppTeamRef.current, Math.floor(Math.random() * BOOK_PAGES) + 1, maxBalls, boParam)
    setOppTeam(next)
  }

  // Skip one full over (6 valid balls) for the computer.
  function skipOver() {
    clearTimeout(compThinkRef.current)
    setCompFlipping(false)
    let team = oppTeamRef.current
    if (team.done) return
    const startBalls  = team.totalBalls
    const targetBalls = (Math.floor(startBalls / 6) + 1) * 6
    let safety = 200
    while (!team.done && team.totalBalls < targetBalls && safety-- > 0) {
      team = applyFlip(team, Math.floor(Math.random() * BOOK_PAGES) + 1, maxBalls, boParam)
    }
    setOppTeam(team)
  }

  // Skip the entire remaining computer innings.
  function skipAll() {
    clearTimeout(compThinkRef.current)
    setCompFlipping(false)
    let team = oppTeamRef.current
    let safety = 2000
    while (!team.done && safety-- > 0) {
      team = applyFlip(team, Math.floor(Math.random() * BOOK_PAGES) + 1, maxBalls, boParam)
    }
    setOppTeam(team)
  }

  const oppLabel = opponent === 'computer' ? 'Computer' : 'Opponent'
  const target   = oppTeam.done && !myTeam.done ? oppTeam.totalRuns + 1 : null

  function formatBadge() {
    if (format === 'test')          return 'Test'
    if (format === 'batsman-overs') return `${batsmanOvers}ov/bat`
    return `${overs}ov`
  }

  return (
    <div className="game bc-game">
      <div className="header">
        <div className="header-left">
          <button className="icon-btn" onClick={onHome}>←</button>
        </div>
        <h1>Book Cricket</h1>
        <div className="header-right">
          <span className="mode-badge" style={{ background: format === 'test' ? '#818384' : format === 'batsman-overs' ? '#5865f2' : '#b59f3b' }}>
            {formatBadge()}
          </span>
          <button className="icon-btn" onClick={() => setShowInfo(true)} title="How to play">?</button>
        </div>
      </div>

      <div className="bc-panels">
        <TeamPanel team={myTeam}  label="You"     isYou={true}  isActive={isMyTurn  && !gameOver} isBOMode={isBOMode} batsmanOvers={batsmanOvers} />
        <TeamPanel team={oppTeam} label={oppLabel} isYou={false} isActive={!isMyTurn && !gameOver} isBOMode={isBOMode} batsmanOvers={batsmanOvers} />
      </div>

      {!gameOver && (
        <div className="bc-action">
          {target && <p className="bc-target">Target: <strong>{target}</strong></p>}

          {isMyTurn && !myTeam.done && (
            <BookFlip key={myTeam.history.length} onResult={handleMyFlip} />
          )}

          {!isMyTurn && opponent === 'computer' && !oppTeam.done && (
            <>
              {compFlipping
                ? <BookFlip key={`c${oppTeam.history.length}`} onResult={handleCompFlip} autoStart />
                : <p className="bc-waiting">{myTeam.done ? 'Computer batting…' : 'Computer thinking…'}</p>
              }
              <div className="bc-skip-controls">
                <button className="bc-skip-ball-btn" onClick={skipBall}>⏭ Skip Ball</button>
                <button className="bc-skip-over-btn" onClick={skipOver}>⏭⏭ Skip Over</button>
                <button className="bc-skip-all-btn"  onClick={skipAll}>⏩ Skip All</button>
              </div>
            </>
          )}

          {!isMyTurn && opponent === 'friend' && !oppTeam.done && (
            <>
              <BookFlip key={`f${oppTeam.history.length}`} onResult={() => {}} spectator />
              <p className="bc-waiting">Opponent is flipping…</p>
            </>
          )}

          {myTeam.done && !oppTeam.done && opponent === 'friend' && (
            <p className="bc-waiting" style={{ marginTop: '0.25rem' }}>
              Your innings complete — watching opponent…
            </p>
          )}
        </div>
      )}

      {gameOver && <p className="bc-waiting" style={{ marginTop: '1rem' }}>Calculating result…</p>}

      {showInfo && <BCInfoModal onClose={() => setShowInfo(false)} />}
    </div>
  )
}
