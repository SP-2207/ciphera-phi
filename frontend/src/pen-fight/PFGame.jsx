import { useState, useEffect, useRef } from 'react'
import { DESK_W, DESK_H, MIDLINE, PEN_L, PEN_W, runSimulation, computeAIFlick } from './pfPhysics'
import { defaultPen } from './pfLogic'
import PFInfoModal from './PFInfoModal'

const PLAYER_COLORS     = ['#c0392b', '#1a6faf']   // deeper red & blue — readable on wood
const MAX_DRAG_PX       = 90
const ANIM_MS_PER_FRAME = 14

// ── Wood grain (deterministic — same result every render) ─────────────────────
const WOOD_GRAINS = (() => {
  const g = []
  for (let i = 0; i < 50; i++) {
    const x     = 2 + i * (DESK_W / 50)
    const drift = Math.sin(i * 1.9) * 9 + Math.sin(i * 0.55) * 15
    const ctrl  = Math.sin(i * 2.7 + 0.8) * 7
    const isLight = i % 4 === 1
    const thick   = i % 5 === 0 ? 1.4 : i % 3 === 0 ? 0.8 : 0.45
    const op      = isLight ? 0.16 + (i % 5) * 0.04 : 0.07 + (i % 4) * 0.025
    g.push({ x, drift, ctrl, thick, isLight, op })
  }
  return g
})()

// ── Pen SVG shape ─────────────────────────────────────────────────────────────

function PenShape({ x, y, angle, color, fell = false }) {
  const hl = PEN_L / 2
  const hw = PEN_W / 2
  // Slightly darkened body colour for the grip section
  const darker = color.replace(/^#/, '')
    .match(/.{2}/g)
    .map(c => Math.max(0, parseInt(c, 16) - 40).toString(16).padStart(2, '0'))
    .join('')
  return (
    <g
      transform={`translate(${x},${y}) rotate(${(angle * 180) / Math.PI})`}
      opacity={fell ? 0 : 1}
      style={{ transition: fell ? 'opacity 0.7s 0.1s ease-in' : 'none' }}
      filter="url(#pen-shadow)"
    >
      {/* Main body */}
      <rect x={-hl} y={-hw} width={hl * 2 - 12} height={hw * 2} rx={hw}
        fill={color} stroke="rgba(0,0,0,0.45)" strokeWidth="1" />
      {/* Grip section — darker */}
      <rect x={-hl} y={-hw} width={hl * 0.55} height={hw * 2} rx={hw}
        fill={`#${darker}`} stroke="rgba(0,0,0,0.35)" strokeWidth="0.5" />
      {/* Grip rings */}
      {[-hl * 0.3, -hl * 0.1].map((rx2, i) => (
        <line key={i} x1={rx2} y1={-hw} x2={rx2} y2={hw}
          stroke="rgba(0,0,0,0.25)" strokeWidth="1.5" />
      ))}
      {/* Eraser nub */}
      <rect x={hl - 14} y={-hw} width={8} height={hw * 2} rx={2}
        fill="rgba(255,200,180,0.85)" stroke="rgba(0,0,0,0.3)" strokeWidth="0.5" />
      {/* Tip / point */}
      <polygon
        points={`${hl - 8},${-hw + 1} ${hl + 2},0 ${hl - 8},${hw - 1}`}
        fill="#d4c5b0"
        stroke="rgba(0,0,0,0.3)" strokeWidth="0.5"
      />
      {/* Shine highlight */}
      <rect x={-hl * 0.5} y={-hw} width={hl * 0.85} height={hw * 0.7} rx={hw * 0.35}
        fill="rgba(255,255,255,0.28)" />
    </g>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function lerp(a, b, t) { return a + (b - a) * t }

function lerpAngle(a, b, t) {
  let diff = b - a
  while (diff >  Math.PI) diff -= 2 * Math.PI
  while (diff < -Math.PI) diff += 2 * Math.PI
  return a + diff * t
}

function makeLerpFrames(from1, from2, to1, to2, p1Fell, p2Fell, n = 45) {
  const frames = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    frames.push({
      p1:    { x: lerp(from1.x, to1.x, t), y: lerp(from1.y, to1.y, t), angle: lerpAngle(from1.angle, to1.angle, t) },
      p2:    { x: lerp(from2.x, to2.x, t), y: lerp(from2.y, to2.y, t), angle: lerpAngle(from2.angle, to2.angle, t) },
      p1Fell: i === n && p1Fell,
      p2Fell: i === n && p2Fell,
    })
  }
  return frames
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PFGame({
  players,         // [{id, initials, slot, isHost, isComputer}]
  mySlot,          // 0 | 1
  myPlayerId,
  mode,            // 'computer' | 'friend'
  difficulty,
  gameState,
  onPlacePen,      // ({ x, y, angle }) → void
  onFlick,         // (finalP1, finalP2, p1Fell, p2Fell) → void  — called after animation
  onHome,
}) {
  const {
    phase, pen1, pen2, p1Placed, p2Placed,
    currentTurn, scores, currentRound, totalRounds, lastResult, lastFlick,
  } = gameState

  const isFlipped  = mySlot === 1
  const isMyTurn   = currentTurn === myPlayerId
  const myColor    = PLAYER_COLORS[mySlot]
  const oppPlayer  = players.find(p => p.id !== myPlayerId)
  const myPlaced   = mySlot === 0 ? p1Placed : p2Placed

  // ── Displayed pen state (driven by animation) ────────────────────────────
  const [disp1,  setDisp1]  = useState(() => pen1 || defaultPen(0))
  const [disp2,  setDisp2]  = useState(() => pen2 || defaultPen(1))
  const [fell1,  setFell1]  = useState(false)
  const [fell2,  setFell2]  = useState(false)

  const animRafRef    = useRef(null)
  const framesRef     = useRef(null)
  const idxRef        = useRef(0)
  const lastTsRef     = useRef(null)
  const localAnimRef  = useRef(false)
  const onDoneRef     = useRef(null)

  // Always-fresh refs so timer callbacks (CPU) never capture stale closure values
  const disp1Ref = useRef(disp1)
  const disp2Ref = useRef(disp2)
  disp1Ref.current = disp1
  disp2Ref.current = disp2

  // ── Placement ────────────────────────────────────────────────────────────
  const pad = PEN_L / 2 + 6
  const [pendX,     setPendX]     = useState(() => DESK_W / 2)
  const [pendY,     setPendY]     = useState(() => mySlot === 0 ? DESK_H * 0.78 : DESK_H * 0.22)
  const [pendAngle, setPendAngle] = useState(0)

  // ── SVG dimensions (explicit px so SVG doesn't collapse in flex) ─────────
  const [viewH, setViewH] = useState(window.innerHeight)
  useEffect(() => {
    const onResize = () => setViewH(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const svgH = Math.min(DESK_H, viewH - 230)
  const svgW = Math.round(DESK_W * svgH / DESK_H)

  // ── Help modal ───────────────────────────────────────────────────────────
  const [showInfo, setShowInfo] = useState(false)

  // ── Gesture (flick) ──────────────────────────────────────────────────────
  const svgRef   = useRef(null)
  const gestRef  = useRef(null)
  const [gesture,    setGesture]    = useState(null)
  const [powerFrac,  setPowerFrac]  = useState(0)

  // ── Round result overlay ─────────────────────────────────────────────────
  const [roundMsg, setRoundMsg] = useState(null)

  // ── Sync displayed pens from Firebase (opponent move in friend mode) ─────
  const prevPen1Ref = useRef(pen1)
  const prevPen2Ref = useRef(pen2)

  useEffect(() => {
    if (localAnimRef.current) return   // own animation already running — skip
    const prev1 = prevPen1Ref.current
    const prev2 = prevPen2Ref.current

    if (pen1 && pen2 && prev1 && prev2) {
      const moved = Math.hypot(pen1.x - prev1.x, pen1.y - prev1.y) > 1 ||
                    Math.hypot(pen2.x - prev2.x, pen2.y - prev2.y) > 1
      if (moved) {
        prevPen1Ref.current = pen1
        prevPen2Ref.current = pen2

        if (lastFlick?.fromP1 && lastFlick?.fromP2) {
          // Re-run the real physics so the viewer sees the actual trajectory + collision
          const sim = runSimulation(
            lastFlick.fromP1, lastFlick.fromP2,
            lastFlick.slot, lastFlick.power, lastFlick.dir
          )
          setFell1(false)
          setFell2(false)
          startAnimation(sim.frames, () => {
            setDisp1(sim.finalP1)
            setDisp2(sim.finalP2)
            setFell1(sim.p1Fell)
            setFell2(sim.p2Fell)
          })
        } else {
          // Fallback: linear interpolation (placement syncs, no flick data)
          const frames = makeLerpFrames(prev1, prev2, pen1, pen2,
            lastResult?.p1Fell, lastResult?.p2Fell)
          startAnimation(frames, () => {
            setFell1(lastResult?.p1Fell || false)
            setFell2(lastResult?.p2Fell || false)
          })
        }
        return   // animation handles disp1/disp2 — don't overwrite below
      }
    }

    // No animation needed (first sync or position unchanged)
    if (pen1) { prevPen1Ref.current = pen1; setDisp1(pen1) }
    if (pen2) { prevPen2Ref.current = pen2; setDisp2(pen2) }
  }, [pen1, pen2]) // eslint-disable-line

  // ── Reset display state at the start of every new round ─────────────────
  // Fires when both pens go null (startNextRound / replayRound), so fell1/fell2
  // are cleared before the 'playing' phase begins — fixes the blank-screen bug.
  useEffect(() => {
    if (pen1 !== null || pen2 !== null || phase !== 'placement') return
    if (animRafRef.current) cancelAnimationFrame(animRafRef.current)
    localAnimRef.current      = false
    prevPen1Ref.current       = null
    prevPen2Ref.current       = null
    setFell1(false)
    setFell2(false)
    setDisp1(defaultPen(0))
    setDisp2(defaultPen(1))
    setPendX(DESK_W / 2)
    setPendY(mySlot === 0 ? DESK_H * 0.78 : DESK_H * 0.22)
    setPendAngle(0)
  }, [pen1, pen2, phase]) // eslint-disable-line

  // ── Show round result ────────────────────────────────────────────────────
  useEffect(() => {
    if (!lastResult?.roundOver) { setRoundMsg(null); return }
    const { p1Fell, p2Fell } = lastResult
    const myFell  = mySlot === 0 ? p1Fell : p2Fell
    const oppFell = mySlot === 0 ? p2Fell : p1Fell
    if (p1Fell && p2Fell) setRoundMsg('Both fell! Tie — replaying this round…')
    else if (myFell)      setRoundMsg('Your pen fell! Opponent wins this round')
    else if (oppFell)     setRoundMsg("Opponent's pen is off the desk! You win this round!")
  }, [lastResult]) // eslint-disable-line

  // ── Animation engine ─────────────────────────────────────────────────────

  function startAnimation(frames, onDone) {
    if (animRafRef.current) cancelAnimationFrame(animRafRef.current)
    framesRef.current  = frames
    idxRef.current     = 0
    lastTsRef.current  = null
    onDoneRef.current  = onDone || null

    function tick(ts) {
      if (!lastTsRef.current) lastTsRef.current = ts
      const elapsed = ts - lastTsRef.current
      lastTsRef.current = ts

      idxRef.current = Math.min(
        Math.floor(idxRef.current + elapsed / ANIM_MS_PER_FRAME),
        framesRef.current.length - 1
      )
      const f = framesRef.current[idxRef.current]
      setDisp1({ x: f.p1.x, y: f.p1.y, angle: f.p1.angle })
      setDisp2({ x: f.p2.x, y: f.p2.y, angle: f.p2.angle })
      if (f.p1Fell) setFell1(true)
      if (f.p2Fell) setFell2(true)

      if (idxRef.current < framesRef.current.length - 1) {
        animRafRef.current = requestAnimationFrame(tick)
      } else {
        localAnimRef.current = false
        if (onDoneRef.current) onDoneRef.current()
        onDoneRef.current = null
      }
    }
    animRafRef.current = requestAnimationFrame(tick)
  }

  useEffect(() => () => {
    if (animRafRef.current) cancelAnimationFrame(animRafRef.current)
  }, [])

  // ── SVG coordinate helpers ────────────────────────────────────────────────

  function svgPosOf(clientX, clientY) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: ((clientX - rect.left) / rect.width)  * DESK_W,
      y: ((clientY - rect.top)  / rect.height) * DESK_H,
    }
  }

  function toWorldPos(svgX, svgY) {
    return isFlipped
      ? { x: DESK_W - svgX, y: DESK_H - svgY }
      : { x: svgX, y: svgY }
  }

  // ── Flick gesture (drag-distance = power, drag direction = aim) ──────────

  function onPointerDown(e) {
    if (!isMyTurn || phase !== 'playing' || localAnimRef.current) return
    e.preventDefault()
    const ev  = e.touches ? e.touches[0] : e
    const pos = svgPosOf(ev.clientX, ev.clientY)
    gestRef.current = { sx: pos.x, sy: pos.y, cx: pos.x, cy: pos.y }
    setPowerFrac(0)
    setGesture({ ...gestRef.current })
  }

  function onPointerMove(e) {
    if (!gestRef.current) return
    e.preventDefault()
    const ev  = e.touches ? e.touches[0] : e
    const pos = svgPosOf(ev.clientX, ev.clientY)
    gestRef.current.cx = pos.x
    gestRef.current.cy = pos.y
    const dist = Math.hypot(pos.x - gestRef.current.sx, pos.y - gestRef.current.sy)
    setPowerFrac(Math.min(1, dist / MAX_DRAG_PX))
    setGesture({ ...gestRef.current })
  }

  function onPointerUp(e) {
    if (!gestRef.current) return
    if (e?.preventDefault) e.preventDefault()
    const g = gestRef.current
    gestRef.current = null
    setGesture(null)
    setPowerFrac(0)

    const ddx     = g.cx - g.sx
    const ddy     = g.cy - g.sy
    const dragDist = Math.hypot(ddx, ddy)
    const power   = Math.max(0.08, Math.min(1, dragDist / MAX_DRAG_PX))

    const curD1      = { ...disp1 }
    const curD2      = { ...disp2 }
    const myDispPen  = mySlot === 0 ? curD1 : curD2
    const oppDispPen = mySlot === 0 ? curD2 : curD1

    let dir
    if (dragDist < 5) {
      // Tap: aim straight at opponent
      dir = Math.atan2(oppDispPen.y - myDispPen.y, oppDispPen.x - myDispPen.x)
    } else {
      dir = Math.atan2(ddy, ddx)
      if (isFlipped) dir += Math.PI
    }

    const result = runSimulation(curD1, curD2, mySlot, power, dir)
    localAnimRef.current = true
    setFell1(false)
    setFell2(false)
    startAnimation(result.frames, () => {
      setDisp1(result.finalP1)
      setDisp2(result.finalP2)
      setFell1(result.p1Fell)
      setFell2(result.p2Fell)
      prevPen1Ref.current = result.finalP1
      prevPen2Ref.current = result.finalP2
      onFlick(result.finalP1, result.finalP2, result.p1Fell, result.p2Fell,
              curD1, curD2, mySlot, power, dir)
    })
  }

  // ── Computer AI trigger ───────────────────────────────────────────────────

  useEffect(() => {
    if (mode !== 'computer' || phase !== 'playing' || isMyTurn || localAnimRef.current) return
    if (!pen1 || !pen2) return

    const timer = setTimeout(() => {  // 1800ms: enough to see the board before CPU fires
      // Use refs — closure captures stale disp1/disp2 when phase first becomes 'playing'
      const curD1 = disp1Ref.current || pen1
      const curD2 = disp2Ref.current || pen2
      // CPU is slot 1 (pen2), always
      const { dir, power } = computeAIFlick(curD2, curD1, difficulty)
      const result = runSimulation(curD1, curD2, 1, power, dir)
      localAnimRef.current = true
      setFell1(false)
      setFell2(false)
      startAnimation(result.frames, () => {
        setDisp1(result.finalP1)
        setDisp2(result.finalP2)
        setFell1(result.p1Fell)
        setFell2(result.p2Fell)
        prevPen1Ref.current = result.finalP1
        prevPen2Ref.current = result.finalP2
        onFlick(result.finalP1, result.finalP2, result.p1Fell, result.p2Fell,
                curD1, curD2, 1, power, dir)
      })
    }, 1800)

    return () => clearTimeout(timer)
  }, [currentTurn, phase]) // eslint-disable-line

  // ── Placement tap ─────────────────────────────────────────────────────────

  function onSVGClick(e) {
    if (phase !== 'placement' || myPlaced) return
    const svgPos = svgPosOf(e.clientX, e.clientY)
    const wp     = toWorldPos(svgPos.x, svgPos.y)
    if (mySlot === 0) {
      if (wp.y < MIDLINE + pad) return
      setPendX(Math.max(pad, Math.min(DESK_W - pad, wp.x)))
      setPendY(Math.min(DESK_H - pad, wp.y))
    } else {
      if (wp.y > MIDLINE - pad) return
      setPendX(Math.max(pad, Math.min(DESK_W - pad, wp.x)))
      setPendY(Math.max(pad, wp.y))
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const contentTransform = isFlipped
    ? `rotate(180, ${DESK_W / 2}, ${DESK_H / 2})`
    : undefined

  // Gesture overlay: power ring + directional arrow with arrowhead
  let gestureOverlay = null
  if (gesture) {
    const dx  = gesture.cx - gesture.sx
    const dy  = gesture.cy - gesture.sy
    const dist = Math.hypot(dx, dy)
    const ang  = Math.atan2(dy, dx)

    // Ring: fills based on drag distance
    const radius  = 20 + powerFrac * 12
    const circ    = 2 * Math.PI * radius
    const dashLen = powerFrac * circ

    // Arrow: length scales with drag (extends beyond the drag point)
    const arrowLen = Math.max(30, Math.min(130, dist * 1.6))
    const headLen  = 14
    const headW    = 8

    const ex = gesture.sx + Math.cos(ang) * arrowLen
    const ey = gesture.sy + Math.sin(ang) * arrowLen
    const bx = ex - Math.cos(ang) * headLen
    const by = ey - Math.sin(ang) * headLen
    const px = -Math.sin(ang) * headW
    const py =  Math.cos(ang) * headW

    gestureOverlay = (
      <g style={{ pointerEvents: 'none' }}>
        {/* Power ring */}
        <circle
          cx={gesture.sx} cy={gesture.sy} r={radius}
          fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="3"
          strokeDasharray={`${dashLen} ${circ}`}
          strokeLinecap="round"
        />
        {/* Arrow shaft + arrowhead */}
        {dist > 6 && (
          <>
            <line
              x1={gesture.sx} y1={gesture.sy} x2={bx} y2={by}
              stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" strokeLinecap="round"
            />
            <polygon
              points={`${ex},${ey} ${bx + px},${by + py} ${bx - px},${by - py}`}
              fill="rgba(255,255,255,0.9)"
            />
          </>
        )}
      </g>
    )
  }

  const statusText = (() => {
    if (phase === 'placement') {
      if (!myPlaced)   return 'Tap your half to position your pen, then confirm'
      const oppPlaced = mySlot === 0 ? p2Placed : p1Placed
      return oppPlaced ? 'Both placed — starting…' : `Waiting for ${oppPlayer?.initials || 'opponent'} to place…`
    }
    if (isMyTurn)              return 'Your turn — hold & drag to flick!'
    if (mode === 'computer')   return 'CPU is thinking…'
    return `${oppPlayer?.initials || '?'} is flicking…`
  })()

  return (
    <div className="game pf-game-screen">
      {showInfo && <PFInfoModal onClose={() => setShowInfo(false)} />}
      <div className="header">
        <div className="header-left">
          <button className="icon-btn" onClick={onHome}>←</button>
        </div>
        <h1>Pen Fight</h1>
        <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span className="pf-round-badge">R{currentRound}/{totalRounds}</span>
          <button className="icon-btn" onClick={() => setShowInfo(true)}>?</button>
        </div>
      </div>

      {/* Scores */}
      <div className="pf-score-bar">
        {players.map((p, i) => (
          <div
            key={p.id}
            className={`pf-score-chip${currentTurn === p.id && phase === 'playing' ? ' pf-score-chip--active' : ''}`}
            style={{ '--chip-color': PLAYER_COLORS[i] }}
          >
            <span>{p.initials}</span>
            <strong>{scores[p.id] || 0}</strong>
          </div>
        ))}
      </div>

      {/* Desk */}
      <div className="pf-desk-wrap">
        <svg
          ref={svgRef}
          className="pf-desk-svg"
          viewBox={`0 0 ${DESK_W} ${DESK_H}`}
          width={svgW}
          height={svgH}
          onMouseDown={phase === 'playing' ? onPointerDown : undefined}
          onMouseMove={phase === 'playing' ? onPointerMove : undefined}
          onMouseUp={phase === 'playing' ? onPointerUp : undefined}
          onMouseLeave={phase === 'playing' ? onPointerUp : undefined}
          onTouchStart={phase === 'playing' ? onPointerDown : undefined}
          onTouchMove={phase === 'playing' ? onPointerMove : undefined}
          onTouchEnd={phase === 'playing' ? onPointerUp : undefined}
          onClick={phase === 'placement' ? onSVGClick : undefined}
          style={{ touchAction: 'none', userSelect: 'none', cursor: phase === 'placement' && !myPlaced ? 'crosshair' : 'default' }}
        >
          {/* Wood desk background */}
          <defs>
            <filter id="pen-shadow" x="-25%" y="-25%" width="150%" height="150%">
              <feDropShadow dx="1.5" dy="2" stdDeviation="2.5" floodColor="rgba(0,0,0,0.65)" />
            </filter>
            <linearGradient id="pf-wood-h" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="#371110" stopOpacity="0.50" />
              <stop offset="18%"  stopColor="#a45430" stopOpacity="0.00" />
              <stop offset="42%"  stopColor="#c49c82" stopOpacity="0.20" />
              <stop offset="58%"  stopColor="#c49c82" stopOpacity="0.20" />
              <stop offset="82%"  stopColor="#a45430" stopOpacity="0.00" />
              <stop offset="100%" stopColor="#371110" stopOpacity="0.50" />
            </linearGradient>
            <linearGradient id="pf-wood-v" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#371110" stopOpacity="0.55" />
              <stop offset="10%"  stopColor="#371110" stopOpacity="0.00" />
              <stop offset="90%"  stopColor="#371110" stopOpacity="0.00" />
              <stop offset="100%" stopColor="#371110" stopOpacity="0.55" />
            </linearGradient>
          </defs>
          {/* Base wood colour */}
          <rect x={0} y={0} width={DESK_W} height={DESK_H} fill="#a45430" rx={6} />
          {/* Lighter centre wash */}
          <rect x={30} y={0} width={DESK_W - 60} height={DESK_H} fill="#bc7348" opacity={0.55} />
          {/* Vertical grain lines — quadratic bezier for gentle natural curve */}
          {WOOD_GRAINS.map((g, i) => (
            <path key={i}
              d={`M ${g.x.toFixed(1)} 0 Q ${(g.x + g.ctrl).toFixed(1)} ${DESK_H * 0.5} ${(g.x + g.drift).toFixed(1)} ${DESK_H}`}
              stroke={g.isLight ? '#c49c82' : '#371110'}
              strokeWidth={g.thick}
              strokeOpacity={g.op}
              fill="none"
            />
          ))}
          {/* Horizontal shadow overlays */}
          <rect x={0} y={0} width={DESK_W} height={DESK_H} fill="url(#pf-wood-h)" rx={6} />
          <rect x={0} y={0} width={DESK_W} height={DESK_H} fill="url(#pf-wood-v)" rx={6} />

          <g transform={contentTransform}>
            {/* Midline */}
            <line
              x1={0} y1={MIDLINE} x2={DESK_W} y2={MIDLINE}
              stroke="rgba(255,255,255,0.30)" strokeWidth="2" strokeDasharray="10,8"
            />

            {/* (labels rendered outside this group for correct visual position) */}

            {/* Pens in game */}
            {pen1 && phase === 'playing' && (
              <PenShape x={disp1.x} y={disp1.y} angle={disp1.angle}
                color={PLAYER_COLORS[0]} fell={fell1} />
            )}
            {pen2 && phase === 'playing' && (
              <PenShape x={disp2.x} y={disp2.y} angle={disp2.angle}
                color={PLAYER_COLORS[1]} fell={fell2} />
            )}

            {/* Placed pens during placement phase */}
            {phase === 'placement' && pen1 && (
              <PenShape x={pen1.x} y={pen1.y} angle={pen1.angle} color={PLAYER_COLORS[0]} />
            )}
            {phase === 'placement' && pen2 && (
              <PenShape x={pen2.x} y={pen2.y} angle={pen2.angle} color={PLAYER_COLORS[1]} />
            )}

            {/* Pending placement preview */}
            {phase === 'placement' && !myPlaced && (
              <g opacity={0.75}>
                <PenShape x={pendX} y={pendY} angle={pendAngle} color={myColor} />
                {/* Tap zone hint for my half */}
                <rect
                  x={0}
                  y={mySlot === 0 ? MIDLINE : 0}
                  width={DESK_W}
                  height={DESK_H / 2}
                  fill="rgba(255,255,255,0.06)"
                  rx={0}
                  style={{ pointerEvents: 'none' }}
                />
              </g>
            )}
          </g>

          {/* Half labels — in SVG (visual) coords, not rotated */}
          <text x={DESK_W / 2} y={DESK_H * 0.925} textAnchor="middle"
            fontSize={10} fill="rgba(255,255,255,0.28)" fontFamily="sans-serif" letterSpacing="1.5">
            YOUR HALF
          </text>
          <text x={DESK_W / 2} y={DESK_H * 0.072} textAnchor="middle"
            fontSize={10} fill="rgba(255,255,255,0.28)" fontFamily="sans-serif" letterSpacing="1.5">
            OPPONENT
          </text>

          {/* Gesture overlay */}
          {gestureOverlay}
        </svg>
      </div>

      {/* Status text */}
      <p className="pf-status">{statusText}</p>

      {/* Placement controls */}
      {phase === 'placement' && !myPlaced && (
        <div className="pf-placement-controls">
          <button
            className="pf-rot-btn"
            onPointerDown={e => { e.preventDefault(); setPendAngle(a => a - Math.PI / 12) }}
          >
            ↺ Rotate L
          </button>
          <button
            className="accept-btn pf-place-btn"
            onClick={() => onPlacePen({ x: pendX, y: pendY, angle: pendAngle })}
          >
            Place Pen ✓
          </button>
          <button
            className="pf-rot-btn"
            onPointerDown={e => { e.preventDefault(); setPendAngle(a => a + Math.PI / 12) }}
          >
            Rotate R ↻
          </button>
        </div>
      )}

      {/* Power label — shown during gesture */}
      {gesture && (
        <div className="pf-power-bar-wrap">
          <span className="pf-power-label">
            Power: {Math.round(powerFrac * 100)}%
            &nbsp;— drag further for more, closer for less
          </span>
        </div>
      )}

      {/* Round result overlay */}
      {roundMsg && (
        <div className="pf-round-overlay">
          <p className="pf-round-msg">{roundMsg}</p>
        </div>
      )}
    </div>
  )
}
