import { useState, useEffect, useRef } from 'react'
import { PLAYER_COLORS } from './dbLogic'

const CELL = 40
const PAD  = 20

// All grid-size-dependent helpers derived from dots at render time
function makeGrid(dots) {
  const cells   = dots - 1
  const svgSize = cells * CELL + 2 * PAD
  const dotPos  = (r, c) => ({ x: PAD + c * CELL, y: PAD + r * CELL })
  const hCoords = idx => {
    const r = Math.floor(idx / cells), c = idx % cells
    return { x1: PAD+c*CELL, y1: PAD+r*CELL, x2: PAD+(c+1)*CELL, y2: PAD+r*CELL }
  }
  const vCoords = idx => {
    const r = Math.floor(idx / dots), c = idx % dots
    return { x1: PAD+c*CELL, y1: PAD+r*CELL, x2: PAD+c*CELL, y2: PAD+(r+1)*CELL }
  }
  return { cells, svgSize, dotPos, hCoords, vCoords }
}

function playerColor(players, playerId) {
  const slot = players.findIndex(p => p.id === playerId)
  return PLAYER_COLORS[slot] || '#888'
}

export default function DBGame({
  players,
  mySlot,
  mode,
  gameState,
  onMove,
  onHome,
  onGameOver,
}) {
  const [hovered,    setHovered]    = useState(null)   // { type, idx }
  const [skipReady,  setSkipReady]  = useState(false)

  const skipTimerRef = useRef(null)

  const DOTS = gameState.dots || 10
  const { cells, svgSize, dotPos, hCoords, vCoords } = makeGrid(DOTS)

  const { hLines, vLines, boxes, scores, currentSlot, phase, turnStartedAt } = gameState
  const isDone    = phase === 'done'
  const isMyTurn  = mySlot === currentSlot && !isDone
  const curPlayer = players[currentSlot]

  // ── Skip timer (friend mode only) ──────────────────────────────────────────
  useEffect(() => {
    if (skipTimerRef.current) clearTimeout(skipTimerRef.current)

    if (mode !== 'friend' || mySlot === currentSlot || isDone) {
      setSkipReady(false)
      return
    }

    setSkipReady(false)
    const elapsed   = Date.now() - (turnStartedAt || Date.now())
    const remaining = Math.max(0, 30_000 - elapsed)
    skipTimerRef.current = setTimeout(() => setSkipReady(true), remaining)

    return () => { if (skipTimerRef.current) clearTimeout(skipTimerRef.current) }
  }, [currentSlot, turnStartedAt, mode, mySlot, isDone]) // eslint-disable-line

  // ── Turn status ────────────────────────────────────────────────────────────
  let turnText
  let turnClass
  if (isDone) {
    turnText  = 'Game over!'
    turnClass = 'db-wait-turn'
  } else if (isMyTurn) {
    turnText  = 'Your turn — draw a line'
    turnClass = 'db-your-turn'
  } else {
    const thinking = mode === 'computer' && curPlayer?.isComputer
    turnText  = `${curPlayer?.initials || '?'}'s turn${thinking ? ' (thinking…)' : '…'}`
    turnClass = 'db-wait-turn'
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="game db-game-screen">
      <div className="header">
        <div className="header-left">
          <button className="icon-btn" onClick={onHome}>←</button>
        </div>
        <h1>Dots &amp; Boxes</h1>
        <div className="header-right" />
      </div>

      {/* Score bar */}
      <div className="db-score-bar">
        {players.map((p, i) => (
          <div
            key={p.id}
            className={`db-score-chip${i === currentSlot && !isDone ? ' db-score-chip--active' : ''}`}
            style={{ '--chip-color': PLAYER_COLORS[i] || '#888' }}
          >
            <span className="db-chip-initials">{p.initials}</span>
            <span className="db-chip-score">{scores[p.id] || 0}</span>
          </div>
        ))}
      </div>

      {/* Turn status */}
      <div className="db-turn-status">
        <span className={turnClass}>{turnText}</span>
        {skipReady && !isDone && (
          <button
            className="db-skip-turn-btn"
            onClick={() => onMove('skip', 0)}
          >
            Skip Turn
          </button>
        )}
        {isDone && (
          <button
            className="accept-btn"
            style={{ marginTop: '0.75rem', display: 'block', marginLeft: 'auto', marginRight: 'auto' }}
            onClick={onGameOver}
          >
            See Results →
          </button>
        )}
      </div>

      {/* SVG grid */}
      <div className="db-grid-scroll">
        <svg
          className="db-grid-svg"
          width={svgSize}
          height={svgSize}
          viewBox={`0 0 ${svgSize} ${svgSize}`}
        >
          {/* Layer 1: Box fills */}
          {boxes.map((pid, i) => {
            if (!pid) return null
            const r    = Math.floor(i / cells)
            const c    = i % cells
            const pos  = dotPos(r, c)
            const slot = players.findIndex(p => p.id === pid)
            const col  = PLAYER_COLORS[slot] || '#888'
            return (
              <g key={`bx-${i}`}>
                <rect
                  x={pos.x} y={pos.y}
                  width={CELL} height={CELL}
                  fill={col + '44'}
                />
                <text
                  x={pos.x + CELL / 2}
                  y={pos.y + CELL / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="10"
                  fontWeight="bold"
                  fill={col}
                  pointerEvents="none"
                >
                  {players[slot]?.initials || '?'}
                </text>
              </g>
            )
          })}

          {/* Layer 2: Drawn lines */}
          {hLines.map((pid, i) => {
            if (!pid) return null
            const { x1, y1, x2, y2 } = hCoords(i)
            return (
              <line
                key={`h-${i}`}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={playerColor(players, pid)}
                strokeWidth="3"
                strokeLinecap="round"
                pointerEvents="none"
              />
            )
          })}
          {vLines.map((pid, i) => {
            if (!pid) return null
            const { x1, y1, x2, y2 } = vCoords(i)
            return (
              <line
                key={`v-${i}`}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={playerColor(players, pid)}
                strokeWidth="3"
                strokeLinecap="round"
                pointerEvents="none"
              />
            )
          })}

          {/* Layer 3: Click targets (only when it's my turn) */}
          {isMyTurn && hLines.map((pid, i) => {
            if (pid) return null
            const { x1, y1, x2 } = hCoords(i)
            const isHov = hovered?.type === 'h' && hovered?.idx === i
            return (
              <g key={`ht-${i}`}>
                {isHov && (
                  <line
                    x1={x1} y1={y1} x2={x2} y2={y1}
                    stroke="#ffffff66"
                    strokeWidth="3"
                    strokeLinecap="round"
                    pointerEvents="none"
                  />
                )}
                <rect
                  x={x1 + 4}
                  y={y1 - 8}
                  width={CELL - 8}
                  height={16}
                  fill="transparent"
                  cursor="pointer"
                  onMouseEnter={() => setHovered({ type: 'h', idx: i })}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => onMove('h', i)}
                />
              </g>
            )
          })}
          {isMyTurn && vLines.map((pid, i) => {
            if (pid) return null
            const { x1, y1, y2 } = vCoords(i)
            const isHov = hovered?.type === 'v' && hovered?.idx === i
            return (
              <g key={`vt-${i}`}>
                {isHov && (
                  <line
                    x1={x1} y1={y1} x2={x1} y2={y2}
                    stroke="#ffffff66"
                    strokeWidth="3"
                    strokeLinecap="round"
                    pointerEvents="none"
                  />
                )}
                <rect
                  x={x1 - 8}
                  y={y1 + 4}
                  width={16}
                  height={CELL - 8}
                  fill="transparent"
                  cursor="pointer"
                  onMouseEnter={() => setHovered({ type: 'v', idx: i })}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => onMove('v', i)}
                />
              </g>
            )
          })}

          {/* Layer 4: Dots */}
          {Array.from({ length: DOTS }, (_, r) =>
            Array.from({ length: DOTS }, (_, c) => {
              const { x, y } = dotPos(r, c)
              return (
                <circle
                  key={`dot-${r}-${c}`}
                  cx={x} cy={y}
                  r={3}
                  fill="#d7dadc"
                  pointerEvents="none"
                />
              )
            })
          )}
        </svg>
      </div>
    </div>
  )
}
