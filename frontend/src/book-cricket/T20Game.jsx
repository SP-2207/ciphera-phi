import { useState, useRef, useEffect } from 'react'
import BookFlip from './BookFlip'
import { newT20State, applyT20Over, oversLabel, runRate, requiredRunRate, T20_OVERS, T20_MAX_BALLS, BOOK_PAGES } from './t20Logic'

// ── Flag display (handles teams without a country flag emoji) ──────────────
function Flag({ team, size = 'md' }) {
  if (team.abbr) {
    const sz = size === 'sm' ? '0.65rem' : size === 'lg' ? '0.85rem' : '0.7rem'
    const h  = size === 'sm' ? '1.1rem' : size === 'lg' ? '1.4rem' : '1.25rem'
    const w  = size === 'sm' ? '1.7rem' : size === 'lg' ? '2.2rem' : '1.9rem'
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: team.accent, borderRadius: 3,
        fontSize: sz, fontWeight: 900, color: '#fff',
        width: w, height: h, letterSpacing: '0.04em',
      }}>
        {team.abbr}
      </span>
    )
  }
  return <>{team.flag}</>
}

// ── Ball pill ─────────────────────────────────────────────────────────────
function T20Ball({ ball, appearing }) {
  if (!ball) return null
  let cls = 't20-ball'
  let label = '?'
  if (ball.wicket)                         { cls += ' t20-ball--wicket'; label = 'W' }
  else if (ball.extra && ball.extraType === 'nb') { cls += ' t20-ball--extra'; label = 'NB' }
  else if (ball.extra && ball.extraType === 'wd') { cls += ' t20-ball--extra'; label = 'WD' }
  else if (ball.dot)                       { cls += ' t20-ball--dot'; label = '•' }
  else if (ball.runs === 4)                { cls += ' t20-ball--four'; label = '4' }
  else if (ball.runs === 6)                { cls += ' t20-ball--six'; label = '6' }
  else                                     { cls += ' t20-ball--runs'; label = String(ball.runs) }
  if (appearing) cls += ' t20-ball--appear'
  return <span className={cls}>{label}</span>
}

// ── Batting scorecard ──────────────────────────────────────────────────────
function BattingCard({ state, country, compact = false }) {
  const extras = state.nbRuns + state.wdRuns
  return (
    <div className="t20-batting-card">
      <div className="t20-bc-header">
        <span><Flag team={country} size="sm" /> {country.name}</span>
        <span className="t20-bc-score">
          {state.totalRuns}/{state.wickets} ({oversLabel(state.totalBalls)} ov)
        </span>
      </div>
      <table className="t20-sc-table">
        <thead>
          <tr className="t20-sc-thead">
            <th className="t20-sc-th">Batsman</th>
            <th className="t20-sc-th t20-sc-th--stat">R</th>
            <th className="t20-sc-th t20-sc-th--stat">B</th>
            <th className="t20-sc-th t20-sc-th--stat">4s</th>
            <th className="t20-sc-th t20-sc-th--stat">6s</th>
          </tr>
        </thead>
        <tbody>
          {state.batsmen.map((p, i) => {
            const isActive  = !state.done && i === state.currentBatsman
            const hasBatted = p.balls > 0 || p.out
            let rowCls = 't20-sc-row'
            if (isActive)  rowCls += ' t20-sc-row--active'
            if (p.out)     rowCls += ' t20-sc-row--out'
            if (compact && !hasBatted && !isActive) return null
            return (
              <tr key={i} className={rowCls}>
                <td className="t20-sc-td">
                  {isActive && <span className="t20-striker">▶ </span>}
                  {p.name}
                  {p.captain && <span className="t20-role-badge t20-role-badge--c">C</span>}
                  {p.wk      && <span className="t20-role-badge t20-role-badge--wk">WK</span>}
                  {p.out     && <span className="t20-out-label"> out</span>}
                </td>
                <td className="t20-sc-td t20-sc-td--stat">{hasBatted ? p.runs : '-'}</td>
                <td className="t20-sc-td t20-sc-td--stat">{hasBatted ? p.balls : '-'}</td>
                <td className="t20-sc-td t20-sc-td--stat">{hasBatted ? p.fours : '-'}</td>
                <td className="t20-sc-td t20-sc-td--stat">{hasBatted ? p.sixes : '-'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {!compact && extras > 0 && (
        <p className="t20-extras-row">
          Extras: NB {state.nbRuns} · WD {state.wdRuns} · Total {extras}
        </p>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function T20Game({ userPlayers, compPlayers, userCountry, compCountry, onHome, onPlayAgain }) {
  // Phase management
  const [phase,        setPhase]        = useState('toss')   // toss|playing|break|done
  const [battingFirst, setBattingFirst] = useState(null)     // 'user'|'comp'
  const [inning,       setInning]       = useState(1)
  const [overNum,      setOverNum]      = useState(0)
  const [firstRuns,    setFirstRuns]    = useState(0)

  // Team states
  const [userState, setUserState] = useState(() => newT20State(userPlayers))
  const [compState, setCompState] = useState(() => newT20State(compPlayers))

  // Over flip/reveal
  const [flipPhase,     setFlipPhase]     = useState('flip')  // flip|revealing|summary
  const [revealedBalls, setRevealedBalls] = useState([])
  const [allOverBalls,  setAllOverBalls]  = useState([])
  const [pendingState,  setPendingState]  = useState(null)

  // Toss
  const [tossFlipped,  setTossFlipped]  = useState(false)
  const [tossWinner,   setTossWinner]   = useState(null)   // 'user'|'comp'

  // Refs
  const revealTimers   = useRef([])
  const summaryTimer   = useRef(null)
  const skipNextResult = useRef(false)
  // Mutable refs so async callbacks always read latest values (avoid stale closures)
  const flipPhaseRef     = useRef('flip')
  const curStateRef      = useRef(null)
  const target2Ref       = useRef(null)
  const isUserBattingRef = useRef(false)
  const setCurStateRef   = useRef(null)

  // Derived
  const isUserBatting = battingFirst !== null && (
    (inning === 1 && battingFirst === 'user') ||
    (inning === 2 && battingFirst !== 'user')
  )
  const curState    = isUserBatting ? userState : compState
  const setCurState = isUserBatting ? setUserState : setCompState
  const curCountry  = isUserBatting ? userCountry : compCountry
  const target2     = inning === 2 ? firstRuns + 1 : null

  // Keep refs in sync with derived/state values on every render
  flipPhaseRef.current     = flipPhase
  curStateRef.current      = curState
  target2Ref.current       = target2
  isUserBattingRef.current = isUserBatting
  setCurStateRef.current   = setCurState

  useEffect(() => {
    return () => {
      revealTimers.current.forEach(clearTimeout)
      clearTimeout(summaryTimer.current)
    }
  }, [])

  // ── Toss ──────────────────────────────────────────────────────────────
  function doToss() {
    const winner = Math.random() < 0.5 ? 'user' : 'comp'
    setTossWinner(winner)
    setTossFlipped(true)
    if (winner === 'comp') {
      setBattingFirst('comp')
    }
  }

  function chooseToss(bat) {
    setBattingFirst(bat ? 'user' : 'comp')
    setPhase('playing')
  }

  function startAfterCompToss() {
    setPhase('playing')
  }

  // ── Flip result handler (called by BookFlip) ───────────────────────────
  function handleFlipResult(page) {
    if (skipNextResult.current) { skipNextResult.current = false; return }
    if (flipPhaseRef.current !== 'flip') return

    let newState, ballResults
    try {
      ;({ newState, ballResults } = applyT20Over(curStateRef.current, page, target2Ref.current))
    } catch (err) {
      console.error('T20: applyT20Over failed', err)
      return
    }

    // Clear any stale reveal timers
    revealTimers.current.forEach(clearTimeout)
    revealTimers.current = []

    setRevealedBalls([])
    setAllOverBalls(ballResults)
    setPendingState(newState)
    setFlipPhase('revealing')

    if (ballResults.length === 0) {
      // Shouldn't happen, but guard: skip straight to summary
      setFlipPhase('summary')
      return
    }

    ballResults.forEach((ball, i) => {
      const t = setTimeout(() => {
        setRevealedBalls(prev => [...prev, ball])
        if (i === ballResults.length - 1) {
          setTimeout(() => {
            setFlipPhase('summary')
            if (!isUserBattingRef.current) {
              clearTimeout(summaryTimer.current)
              summaryTimer.current = setTimeout(() => {
                advanceFromSummaryRef.current(newState)
              }, 2500)
            }
          }, 400)
        }
      }, i * 380 + 150)
      revealTimers.current.push(t)
    })
  }

  // Stable ref so the summary timer always calls the latest advanceFromSummary
  const advanceFromSummaryRef = useRef(null)

  function advanceFromSummary(finalState) {
    clearTimeout(summaryTimer.current)
    if (!finalState) finalState = pendingState
    setCurStateRef.current(finalState)

    const nextOver = overNum + 1
    if (finalState.done || nextOver >= T20_OVERS) {
      if (inning === 1) {
        setFirstRuns(finalState.totalRuns)
        setPhase('break')
      } else {
        setPhase('done')
      }
    } else {
      setOverNum(nextOver)
      setRevealedBalls([])
      setAllOverBalls([])
      setPendingState(null)
      setFlipPhase('flip')
    }
  }
  advanceFromSummaryRef.current = advanceFromSummary

  // ── Skip controls (computer batting only) ────────────────────────────
  function skipOver() {
    skipNextResult.current = true
    revealTimers.current.forEach(clearTimeout)
    clearTimeout(summaryTimer.current)

    const anchor = Math.floor(Math.random() * BOOK_PAGES) + 1
    const { newState, ballResults } = applyT20Over(curStateRef.current, anchor, target2Ref.current)

    setAllOverBalls(ballResults)
    setRevealedBalls(ballResults)
    setPendingState(newState)
    setFlipPhase('summary')
    summaryTimer.current = setTimeout(() => advanceFromSummaryRef.current(newState), 1500)
  }

  function skipAll() {
    revealTimers.current.forEach(clearTimeout)
    clearTimeout(summaryTimer.current)
    skipNextResult.current = true

    let state = curStateRef.current
    let ovs   = overNum
    while (!state.done && ovs < T20_OVERS) {
      const anchor = Math.floor(Math.random() * BOOK_PAGES) + 1
      const { newState } = applyT20Over(state, anchor, target2Ref.current)
      state = newState
      ovs++
    }
    setCurStateRef.current(state)

    if (inning === 1) {
      setFirstRuns(state.totalRuns)
      setPhase('break')
    } else {
      setPhase('done')
    }
  }

  // ── Start 2nd innings ─────────────────────────────────────────────────
  function startSecondInnings() {
    setInning(2)
    setOverNum(0)
    setRevealedBalls([])
    setAllOverBalls([])
    setPendingState(null)
    setFlipPhase('flip')
    setPhase('playing')
  }

  // ── Result helpers ────────────────────────────────────────────────────
  function ResultBanner() {
    const inn1 = battingFirst === 'user' ? userState : compState
    const inn2 = battingFirst === 'user' ? compState : userState
    const c1   = battingFirst === 'user' ? userCountry : compCountry
    const c2   = battingFirst === 'user' ? compCountry : userCountry
    if (inn2.totalRuns > inn1.totalRuns) {
      const wkts = 10 - inn2.wickets
      return <><Flag team={c2} /> {c2.name} won by {wkts} wicket{wkts !== 1 ? 's' : ''}!</>
    }
    if (inn1.totalRuns > inn2.totalRuns) {
      const runs = inn1.totalRuns - inn2.totalRuns
      return <><Flag team={c1} /> {c1.name} won by {runs} run{runs !== 1 ? 's' : ''}!</>
    }
    return <>Match Tied! 🤝</>
  }

  // ─────────────────────────────── RENDER ──────────────────────────────

  // ── Toss screen ───────────────────────────────────────────────────────
  if (phase === 'toss') {
    return (
      <div className="game">
        <div className="header">
          <div className="header-left"><button className="icon-btn" onClick={onHome}>←</button></div>
          <h1>T20 Match</h1>
          <div className="header-right" />
        </div>
        <div className="t20-toss-screen">
          <div className="t20-matchup">
            <span className="t20-matchup-flag"><Flag team={userCountry} size="lg" /></span>
            <span className="t20-matchup-name">{userCountry.name}</span>
            <span className="t20-matchup-vs">vs</span>
            <span className="t20-matchup-flag"><Flag team={compCountry} size="lg" /></span>
            <span className="t20-matchup-name">{compCountry.name}</span>
          </div>
          <p className="t20-toss-sub">ICC Men's T20 World Cup</p>

          {!tossFlipped && (
            <button className="accept-btn" style={{ marginTop: '2rem' }} onClick={doToss}>
              🪙 Flip the Toss
            </button>
          )}

          {tossFlipped && tossWinner === 'user' && (
            <div className="t20-toss-result">
              <p className="t20-toss-win"><Flag team={userCountry} size="sm" /> {userCountry.name} won the toss!</p>
              <p className="t20-toss-choose">Choose to:</p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                <button className="accept-btn" onClick={() => chooseToss(true)}>🏏 Bat First</button>
                <button className="bc-skip-all-btn" onClick={() => chooseToss(false)}>🥎 Bowl First</button>
              </div>
            </div>
          )}

          {tossFlipped && tossWinner === 'comp' && (
            <div className="t20-toss-result">
              <p className="t20-toss-win">
                <Flag team={compCountry} size="sm" /> {compCountry.name} won the toss and elected to bat first.
              </p>
              <button className="accept-btn" style={{ marginTop: '1rem' }} onClick={startAfterCompToss}>
                Start Match →
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Innings break ──────────────────────────────────────────────────────
  if (phase === 'break') {
    const inn1State   = battingFirst === 'user' ? userState : compState
    const inn1Country = battingFirst === 'user' ? userCountry : compCountry
    const inn2Country = battingFirst === 'user' ? compCountry : userCountry
    const target      = inn1State.totalRuns + 1
    return (
      <div className="game">
        <div className="header">
          <div className="header-left"><button className="icon-btn" onClick={onHome}>←</button></div>
          <h1>Innings Break</h1>
          <div className="header-right" />
        </div>
        <div className="t20-break-screen">
          {/* Full batting scorecard of first innings */}
          <BattingCard state={inn1State} country={inn1Country} />

          {/* Target banner */}
          <div className="t20-break-target">
            <p><Flag team={inn2Country} size="sm" /> {inn2Country.name} need</p>
            <p className="t20-break-target-num">{target}</p>
            <p>to win from {T20_OVERS} overs</p>
          </div>
          <button className="accept-btn" onClick={startSecondInnings}>
            Start 2nd Innings →
          </button>
        </div>
      </div>
    )
  }

  // ── Result screen ──────────────────────────────────────────────────────
  if (phase === 'done') {
    const inn1State   = battingFirst === 'user' ? userState : compState
    const inn2State   = battingFirst === 'user' ? compState : userState
    const inn1Country = battingFirst === 'user' ? userCountry : compCountry
    const inn2Country = battingFirst === 'user' ? compCountry : userCountry
    return (
      <div className="game">
        <div className="header">
          <div className="header-left"><button className="icon-btn" onClick={onHome}>←</button></div>
          <h1>Match Result</h1>
          <div className="header-right" />
        </div>
        <div className="t20-result-screen">
          <div className="t20-result-banner"><ResultBanner /></div>

          <BattingCard state={inn1State} country={inn1Country} />
          <BattingCard state={inn2State} country={inn2Country} />

          <div className="t20-result-actions">
            <button className="hub-back-btn" onClick={onHome}>← Games Hub</button>
            <button className="accept-btn" onClick={onPlayAgain}>Play Again</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Playing screen ─────────────────────────────────────────────────────
  const overLabel     = `Over ${overNum + 1} / ${T20_OVERS}`
  const crr           = runRate(curState.totalRuns, curState.totalBalls)
  const rrr           = inning === 2 ? requiredRunRate(target2 - curState.totalRuns, T20_MAX_BALLS - curState.totalBalls) : null
  const chaseSummary  = inning === 2 ? `Need ${Math.max(0, target2 - curState.totalRuns)} from ${T20_MAX_BALLS - curState.totalBalls} balls` : null

  return (
    <div className="game t20-game-screen">
      <div className="header">
        <div className="header-left"><button className="icon-btn" onClick={onHome}>←</button></div>
        <h1>{isUserBatting ? 'Your Innings' : 'Computer Batting'}</h1>
        <div className="header-right" />
      </div>

      <div className="t20-game-wrap">
        <div className="t20-game-scroll">
          {/* Score bar */}
          <div className="t20-score-bar">
            <div className="t20-score-main">
              <span className="t20-score-flag"><Flag team={curCountry} /></span>
              <span className="t20-score-runs">{curState.totalRuns}/{curState.wickets}</span>
              <span className="t20-score-overs">({oversLabel(curState.totalBalls)} ov)</span>
            </div>
            <div className="t20-score-meta">
              <span>{overLabel}</span>
              <span>CRR {crr}</span>
              {rrr && <span>RRR {rrr}</span>}
            </div>
            {chaseSummary && <div className="t20-chase-summary">{chaseSummary}</div>}
          </div>

          {/* Compact batting table — show batted + current batsman */}
          <BattingCard state={curState} country={curCountry} compact />

          {/* Current over balls */}
          {(flipPhase === 'revealing' || flipPhase === 'summary') && (
            <div className="t20-over-section">
              <span className="t20-over-label">Over {overNum + 1}</span>
              <div className="t20-over-balls">
                {allOverBalls.map((ball, i) => {
                  const revealed = revealedBalls.length > i
                  const appearing = revealedBalls.length === i + 1
                  return revealed ? <T20Ball key={i} ball={ball} appearing={appearing} /> : (
                    <span key={i} className="t20-ball t20-ball--hidden">?</span>
                  )
                })}
              </div>
              {flipPhase === 'summary' && (
                <div className="t20-over-summary">
                  Over {overNum + 1}: {allOverBalls.reduce((s, b) => s + b.runs, 0)} runs
                  {allOverBalls.some(b => b.wicket) && ', 1 wkt'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action area — pinned footer on mobile */}
        <div className="t20-action-area">
          {/* Flip phase */}
          {flipPhase === 'flip' && (
            <>
              <p className="t20-flip-hint">
                {isUserBatting
                  ? `Flip the book — your stop point sets Ball 1 of Over ${overNum + 1}`
                  : `Computer is bowling Over ${overNum + 1}…`}
              </p>
              <BookFlip
                key={`${inning}-${overNum}`}
                autoStart={!isUserBatting}
                onResult={handleFlipResult}
              />
              {!isUserBatting && flipPhase === 'flip' && (
                <div className="bc-skip-row">
                  <button className="bc-skip-all-btn" onClick={skipOver}>Skip Over</button>
                  <button className="bc-skip-all-btn" onClick={skipAll} style={{ background: '#37474f' }}>Skip All</button>
                </div>
              )}
            </>
          )}

          {/* Revealing phase */}
          {flipPhase === 'revealing' && (
            <p className="t20-reveal-hint">Generating over…</p>
          )}

          {/* Summary phase — Next Over button */}
          {flipPhase === 'summary' && (
            <div className="t20-summary-actions">
              {pendingState?.done || overNum + 1 >= T20_OVERS ? (
                <button className="accept-btn" onClick={() => advanceFromSummary(pendingState)}>
                  {inning === 1 ? 'Innings Complete →' : 'See Result →'}
                </button>
              ) : (
                <button className="accept-btn" onClick={() => advanceFromSummary(pendingState)}>
                  {isUserBatting ? `Bowl Over ${overNum + 2} →` : `Next Over →`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
