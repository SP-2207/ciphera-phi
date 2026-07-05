import { useState, useRef, useEffect } from 'react'
import { BOOK_PAGES } from './bcLogic'

// phase: 'idle' | 'flipping' | 'settled'
export default function BookFlip({
  onResult,
  maxPages  = BOOK_PAGES,
  autoStart = false,
  disabled  = false,
  spectator = false,   // spectator mode: animation only, no controls or page readout
}) {
  const [phase,   setPhase]   = useState('idle')
  const [display, setDisplay] = useState(null)
  const [pageKey, setPageKey] = useState(0)

  const finalRef   = useRef(null)
  const timerRef   = useRef(null)
  const pageKeyRef = useRef(0)

  useEffect(() => {
    if (autoStart || spectator) startFlip()
    return () => clearTimeout(timerRef.current)
  }, []) // eslint-disable-line

  function startFlip() {
    if (phase === 'flipping' || phase === 'settled') return
    finalRef.current = Math.floor(Math.random() * maxPages) + 1

    setPhase('flipping')
    pageKeyRef.current = 1
    setPageKey(1)
    setDisplay(Math.floor(Math.random() * maxPages) + 1)

    let count = 0
    const total = 13 + Math.floor(Math.random() * 5)

    function tick(delay) {
      timerRef.current = setTimeout(() => {
        count++
        if (count >= total) {
          setDisplay(finalRef.current)
          pageKeyRef.current++
          setPageKey(pageKeyRef.current)
          setPhase('settled')
          timerRef.current = setTimeout(() => onResult(finalRef.current), 500)
        } else {
          setDisplay(Math.floor(Math.random() * maxPages) + 1)
          pageKeyRef.current++
          setPageKey(pageKeyRef.current)
          const next = count < total * 0.55 ? delay : Math.min(delay + 20, 260)
          tick(next)
        }
      }, delay)
    }

    tick(32)
  }

  function skip() {
    clearTimeout(timerRef.current)
    setDisplay(finalRef.current)
    setPhase('settled')
    timerRef.current = setTimeout(() => onResult(finalRef.current), 500)
  }

  return (
    <div className="bc-flip">
      {/* Open-book graphic */}
      <div className={`bc-book-widget${phase === 'settled' ? ' bc-book-widget--settled' : ''}`}>
        <div className="bc-book-cover">
          <div className="bc-book-left-page" />
          <div className="bc-book-spine" />
          <div className="bc-book-right-page" />
        </div>

        {phase === 'flipping' && (
          <div className="bc-page-anim" key={pageKey}>
            <span className="bc-page-anim-num">{display}</span>
          </div>
        )}
      </div>

      {/* Page number readout — hidden in spectator mode */}
      {!spectator && (
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

      {/* Controls */}
      {!autoStart && !spectator && (
        <button
          className="bc-flip-btn"
          onClick={startFlip}
          disabled={disabled || phase !== 'idle'}
        >
          {phase === 'flipping' ? 'Flipping…' : phase === 'settled' ? 'Scoring…' : '📖 Flip Book'}
        </button>
      )}

      {autoStart && !spectator && phase === 'flipping' && (
        <button className="bc-skip-btn" onClick={skip}>Skip →</button>
      )}
    </div>
  )
}
