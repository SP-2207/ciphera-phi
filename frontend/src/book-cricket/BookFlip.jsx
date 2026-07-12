import { useState, useRef, useEffect } from 'react'
import { BOOK_PAGES } from './bcLogic'

// Player mode: auto-starts, user clicks to stop. Page = f(elapsed time).
// autoStart / spectator: existing automatic behaviour (unchanged).
const PLAYER_MAX_MS = 4000   // auto-stop at 4 s → page 500 → wicket
const PLAYER_TICK   = 50     // counter refresh rate (ms)

function pageFromElapsed(elapsed) {
  if (elapsed >= PLAYER_MAX_MS) return 500
  return Math.max(1, Math.min(499, Math.round(1 + (elapsed / PLAYER_MAX_MS) * 498)))
}

function dangerFor(page) {
  if (page >= 470) return 'red'
  if (page >= 330) return 'orange'
  if (page >= 160) return 'yellow'
  return 'green'
}

function promptFor(page) {
  const d = page % 10
  if (page === 0 || page === 1) return 'Pages are turning — stop when you like!'
  if (d === 0)  return '🚨 Zero digit — WICKET if you stop now!'
  if (d === 5)  return '5 → No-Ball (+1 run, extra ball)'
  if (d === 9)  return '9 → Wide (+1 run, extra ball)'
  if (d === 7 || d === 8) return 'Dot ball here — keep going?'
  if (page >= 470) return `⚠️ Almost 500 — STOP before wicket!`
  if (page >= 330) return 'Getting risky — stop soon!'
  return `${d} run${d !== 1 ? 's' : ''} if you stop now`
}

export default function BookFlip({
  onResult,
  maxPages  = BOOK_PAGES,
  autoStart = false,
  spectator = false,
}) {
  const isPlayerMode = !autoStart && !spectator

  const [phase,   setPhase]   = useState('idle')
  const [display, setDisplay] = useState(isPlayerMode ? 1 : null)
  const [pageKey, setPageKey] = useState(0)

  const startTimeRef = useRef(null)
  const finalRef     = useRef(null)
  const timerRef     = useRef(null)
  const tickRef      = useRef(null)
  const flipKeyRef   = useRef(0)
  // Mutable refs so async callbacks always use current values (avoid stale closures)
  const phaseRef     = useRef('idle')   // mirrors phase state, writable by setters
  const settledRef   = useRef(false)    // guards against double-settle
  const onResultRef  = useRef(onResult) // always latest onResult prop
  onResultRef.current = onResult

  useEffect(() => {
    if (isPlayerMode) {
      startPlayerFlip()
    } else {
      startAutoFlip()
    }
    return () => {
      clearTimeout(timerRef.current)
      clearInterval(tickRef.current)
    }
  }, []) // eslint-disable-line

  // ── Player mode ───────────────────────────────────────────
  function startPlayerFlip() {
    settledRef.current   = false
    phaseRef.current     = 'flipping'
    startTimeRef.current = Date.now()
    setPhase('flipping')

    let flipFrame = 0
    tickRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      const page = pageFromElapsed(elapsed)
      setDisplay(page)

      flipFrame++
      if (flipFrame % 3 === 0) {
        setPageKey(k => k + 1)
      }

      if (elapsed >= PLAYER_MAX_MS) {
        clearInterval(tickRef.current)
        settlePlayer(500)
      }
    }, PLAYER_TICK)
  }

  function stopPlayerFlip() {
    if (phaseRef.current !== 'flipping') return  // use ref — never stale
    clearInterval(tickRef.current)
    const elapsed = Date.now() - startTimeRef.current
    settlePlayer(pageFromElapsed(elapsed))
  }

  function settlePlayer(page) {
    if (settledRef.current) return   // prevent double-settle
    settledRef.current = true
    phaseRef.current   = 'settled'
    finalRef.current   = page
    setDisplay(page)
    setPhase('settled')
    timerRef.current = setTimeout(() => onResultRef.current(page), 600)
  }

  // ── Auto / computer mode (unchanged) ─────────────────────
  function startAutoFlip() {
    finalRef.current = Math.floor(Math.random() * maxPages) + 1
    setPhase('flipping')
    flipKeyRef.current = 1
    setPageKey(1)
    setDisplay(Math.floor(Math.random() * maxPages) + 1)

    let count = 0
    const total = 13 + Math.floor(Math.random() * 5)

    function tick(delay) {
      timerRef.current = setTimeout(() => {
        count++
        if (count >= total) {
          setDisplay(finalRef.current)
          setPageKey(k => k + 1)
          setPhase('settled')
          timerRef.current = setTimeout(() => onResultRef.current(finalRef.current), 500)
        } else {
          setDisplay(Math.floor(Math.random() * maxPages) + 1)
          setPageKey(k => k + 1)
          tick(count < total * 0.55 ? delay : Math.min(delay + 20, 260))
        }
      }, delay)
    }
    tick(32)
  }

  function skipAuto() {
    clearTimeout(timerRef.current)
    setDisplay(finalRef.current)
    setPhase('settled')
    timerRef.current = setTimeout(() => onResult(finalRef.current), 500)
  }

  // ── Render ────────────────────────────────────────────────
  const danger  = isPlayerMode && display ? dangerFor(display) : 'green'
  const prompt  = isPlayerMode && phase === 'flipping' ? promptFor(display) : ''
  const pct     = isPlayerMode ? ((display || 1) / 500) * 100 : 0
  const isWicketPage = display % 10 === 0

  return (
    <div className="bc-flip">

      {/* ── Book widget ── */}
      <div
        className={[
          'bc-book-widget',
          phase === 'settled'   ? 'bc-book-widget--settled' : '',
          isPlayerMode && phase === 'flipping' ? `bc-book-clickable bc-book-clickable--${danger}` : '',
        ].join(' ')}
        onClick={isPlayerMode && phase === 'flipping' ? stopPlayerFlip : undefined}
      >
        <div className="bc-book-cover">
          <div className="bc-book-left-page" />
          <div className="bc-book-spine" />
          <div className="bc-book-right-page">
            {/* In player mode show the live counter ON the right page */}
            {isPlayerMode && phase === 'flipping' && (
              <div className={`bc-player-page-num bc-player-page-num--${danger}`} key={pageKey}>
                {display}
              </div>
            )}
          </div>
        </div>

        {/* Auto/spectator: classic flying-page animation */}
        {!isPlayerMode && phase === 'flipping' && (
          <div className="bc-page-anim" key={pageKey}>
            <span className="bc-page-anim-num">{display}</span>
          </div>
        )}
      </div>

      {/* ── Player mode UI ── */}
      {isPlayerMode && (
        <>
          {/* Progress bar */}
          {phase === 'flipping' && (
            <div className="bc-prog-wrap">
              <div className={`bc-prog-bar bc-prog-bar--${danger}`} style={{ width: `${pct}%` }} />
              <span className={`bc-prog-label bc-prog-label--${danger}`}>
                {display} / 500
              </span>
            </div>
          )}

          {/* Contextual prompt */}
          {phase === 'flipping' && (
            <p className={`bc-flip-prompt bc-flip-prompt--${danger}${isWicketPage ? ' bc-flip-prompt--wicket' : ''}`}>
              {prompt}
            </p>
          )}

          {/* Stop button */}
          {phase === 'flipping' && (
            <button
              className={`bc-stop-btn bc-stop-btn--${danger}`}
              onClick={stopPlayerFlip}
            >
              ✋ Stop!
            </button>
          )}

          {/* Settled */}
          {phase === 'settled' && (
            <div className="bc-page-readout bc-page-readout--show">
              <span className="bc-readout-label">Page</span>
              <span className="bc-readout-num">{display}</span>
            </div>
          )}
        </>
      )}

      {/* ── Auto mode readout ── */}
      {!isPlayerMode && !spectator && (
        <div className={`bc-page-readout${phase === 'settled' ? ' bc-page-readout--show' : ''}`}>
          {phase === 'idle'     && <span className="bc-readout-idle">?</span>}
          {phase === 'flipping' && <span className="bc-readout-spin">{display}</span>}
          {phase === 'settled'  && (
            <>
              <span className="bc-readout-label">Page</span>
              <span className="bc-readout-num">{display}</span>
            </>
          )}
        </div>
      )}

      {/* Auto mode skip */}
      {autoStart && !spectator && phase === 'flipping' && (
        <button className="bc-skip-btn" onClick={skipAuto}>Skip →</button>
      )}
    </div>
  )
}
