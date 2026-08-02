// World coordinate system: (0,0) top-left, (DESK_W, DESK_H) bottom-right
// Player 1 occupies bottom half (y > DESK_H/2), Player 2 top half (y < DESK_H/2)

export const DESK_W  = 400
export const DESK_H  = 500
export const MIDLINE = DESK_H / 2
export const PEN_L   = 80   // full pen length (world units)
export const PEN_W   = 10   // pen capsule diameter

// Physics constants
// FRICTION: 120 → 30% power stays in own half, 55%+ crosses desk cleanly
const FRICTION     = 120
const ROT_FRICTION = 3.0
// RESTITUTION 0.50: billiards-like — struck pen gets ~75% speed, flicking pen → ~25% forward
const RESTITUTION  = 0.50

export const MAX_SPEED = 780   // px/s at full power — snappy but not instant
export const MAX_OMEGA = 16    // rad/s at full power

const MASS  = 1
const I_PEN = MASS * (PEN_L ** 2 + PEN_W ** 2) / 12  // moment of inertia

// ── Geometry ─────────────────────────────────────────────────────────────────

function dot(a, b)    { return a.x * b.x + a.y * b.y }
function sub(a, b)    { return { x: a.x - b.x, y: a.y - b.y } }
function add(a, b)    { return { x: a.x + b.x, y: a.y + b.y } }
function scale(v, s)  { return { x: v.x * s, y: v.y * s } }
function len(v)       { return Math.sqrt(v.x * v.x + v.y * v.y) }
function cross2(a, b) { return a.x * b.y - a.y * b.x }
function norm(v)      { const l = len(v) || 1e-9; return { x: v.x / l, y: v.y / l } }

// Pen endpoints: [tip, tail]
function penEnds(pen) {
  const half = PEN_L / 2
  const dx   = Math.cos(pen.angle) * half
  const dy   = Math.sin(pen.angle) * half
  return [{ x: pen.x + dx, y: pen.y + dy }, { x: pen.x - dx, y: pen.y - dy }]
}

// Closest points between segments A(a0→a1) and B(b0→b1)
function closestSegSeg(a0, a1, b0, b1) {
  const da = sub(a1, a0), db = sub(b1, b0), dc = sub(b0, a0)

  // ── 2D intersection test — MUST run before the dot-product formula. ───────
  // The dot-product formula is for 3D skew lines; for 2D crossing segments it
  // yields totally wrong s/t (e.g. s=−0.5 when correct answer is s=0.5),
  // so the closest distance comes back as ~50 instead of 0 and the collision
  // is never detected — the pen phases straight through.
  const cr = cross2(da, db)
  if (Math.abs(cr) > 1e-10) {
    const si = cross2(dc, db) / cr
    const ti = cross2(dc, da) / cr
    if (si >= -1e-9 && si <= 1 + 1e-9 && ti >= -1e-9 && ti <= 1 + 1e-9) {
      // Segments cross — minimum distance is 0 at the intersection point
      const pI = add(a0, scale(da, Math.min(1, Math.max(0, si))))
      return { pA: pI, pB: pI, dist: 0 }
    }
  }

  // ── Segments do not cross — dot-product closest-point formula ────────────
  const A = dot(da, da), E = dot(db, db), F = dot(db, dc)
  let s, t

  if (A < 1e-10 && E < 1e-10) {
    return { pA: a0, pB: b0, dist: len(sub(a0, b0)) }
  }
  if (A < 1e-10) {
    s = 0; t = Math.min(1, Math.max(0, F / E))
  } else {
    const C = dot(da, dc)
    if (E < 1e-10) {
      t = 0; s = Math.min(1, Math.max(0, -C / A))
    } else {
      const B = dot(da, db)
      const denom = A * E - B * B
      s = denom > 1e-10 ? Math.min(1, Math.max(0, (B * F - C * E) / denom)) : 0
      t = (B * s + F) / E
      if (t < 0) {
        t = 0; s = Math.min(1, Math.max(0, -C / A))
      } else if (t > 1) {
        t = 1; s = Math.min(1, Math.max(0, (B - C) / A))
      }
    }
  }
  const pA = add(a0, scale(da, s))
  const pB = add(b0, scale(db, t))
  return { pA, pB, dist: len(sub(pA, pB)) }
}

// ── Collision ─────────────────────────────────────────────────────────────────

export function detectCollision(p1, p2) {
  const [a0, a1] = penEnds(p1)
  const [b0, b1] = penEnds(p2)
  const { pA, pB, dist } = closestSegSeg(a0, a1, b0, b1)
  if (dist >= PEN_W) return null
  const raw = sub(pA, pB)
  let n
  if (len(raw) > 1e-6) {
    n = norm(raw)  // pA is on p1's segment, pB on p2's → n points from p2 toward p1
  } else {
    // Segments are crossing (dist≈0): closest points coincide, so raw≈(0,0).
    // The hardcoded fallback { x:0, y:-1 } is WRONG half the time and causes
    // vRel > 0 → impulse skipped + correction pushes pens together → phase-through.
    // Use center-to-center direction: always points from p2 toward p1.
    const cc = sub({ x: p1.x, y: p1.y }, { x: p2.x, y: p2.y })
    n = len(cc) > 1e-6 ? norm(cc) : { x: 1, y: 0 }
  }
  return { n, cA: pA, cB: pB, depth: PEN_W - dist }
}

export function resolveCollision(p1, p2, col) {
  const { n, cA, cB } = col
  const r1   = sub(cA, { x: p1.x, y: p1.y })
  const r2   = sub(cB, { x: p2.x, y: p2.y })
  const v1c  = { x: p1.vx - p1.omega * r1.y, y: p1.vy + p1.omega * r1.x }
  const v2c  = { x: p2.vx - p2.omega * r2.y, y: p2.vy + p2.omega * r2.x }
  const vRel = dot(sub(v1c, v2c), n)
  if (vRel >= 0) return
  const r1n = cross2(r1, n)
  const r2n = cross2(r2, n)
  const j   = -(1 + RESTITUTION) * vRel /
              (2 / MASS + r1n * r1n / I_PEN + r2n * r2n / I_PEN)
  p1.vx += j / MASS * n.x;  p1.vy += j / MASS * n.y;  p1.omega += r1n * j / I_PEN
  p2.vx -= j / MASS * n.x;  p2.vy -= j / MASS * n.y;  p2.omega -= r2n * j / I_PEN
}

// ── Step ─────────────────────────────────────────────────────────────────────

export function stepPen(pen, dt) {
  const speed = Math.hypot(pen.vx, pen.vy)
  let vx = pen.vx, vy = pen.vy, omega = pen.omega

  if (speed > 1e-3) {
    const dec = Math.min(speed, FRICTION * dt)
    vx *= (speed - dec) / speed
    vy *= (speed - dec) / speed
  } else { vx = 0; vy = 0 }

  const asp = Math.abs(omega)
  if (asp > 1e-4) {
    omega *= Math.max(0, asp - ROT_FRICTION * dt) / asp
  } else { omega = 0 }

  return {
    ...pen,
    x:     pen.x + vx * dt,
    y:     pen.y + vy * dt,
    angle: pen.angle + omega * dt,
    vx, vy, omega,
  }
}

export function isOnDesk(pen) {
  return pen.x > 2 && pen.x < DESK_W - 2 && pen.y > 2 && pen.y < DESK_H - 2
}

// ── Apply flick ───────────────────────────────────────────────────────────────

// power ∈ [0,1], dir = angle in radians (world coords)
export function applyFlick(pen, power, dir) {
  const speed     = power * MAX_SPEED
  const angleDiff = dir - pen.angle
  return {
    ...pen,
    vx:    speed * Math.cos(dir),
    vy:    speed * Math.sin(dir),
    omega: power * MAX_OMEGA * Math.sin(angleDiff),
  }
}

// ── Full simulation ───────────────────────────────────────────────────────────

// whichPen: 0 = flick pen1, 1 = flick pen2
export function runSimulation(pen1, pen2, whichPen, power, dir) {
  let p1 = { ...pen1, vx: 0, vy: 0, omega: 0 }
  let p2 = { ...pen2, vx: 0, vy: 0, omega: 0 }
  if (whichPen === 0) p1 = applyFlick(p1, power, dir)
  else                p2 = applyFlick(p2, power, dir)

  // DT=1/240: at MAX_SPEED=780, max 3.25 units/step — well below PEN_W=10 collision threshold.
  // This prevents tunneling (pen phasing through opponent) that happened at DT=1/120.
  const DT = 1 / 240
  const FELL_EXTRA = 100  // extra steps after falling (≈0.42s of slide-off animation)

  const frames = []
  let p1Fell = false, p2Fell = false
  let p1FellAt = Infinity, p2FellAt = Infinity
  let finalP1 = null, finalP2 = null

  for (let i = 0; i < 240 * 10; i++) {
    const p1Active = !p1Fell || (i - p1FellAt < FELL_EXTRA)
    const p2Active = !p2Fell || (i - p2FellAt < FELL_EXTRA)
    if (p1Active) p1 = stepPen(p1, DT)
    if (p2Active) p2 = stepPen(p2, DT)

    // Collision only while both are still on desk
    if (!p1Fell && !p2Fell) {
      const col = detectCollision(p1, p2)
      if (col) {
        // Push pens 50% apart each step — resolves overlap within 2 steps
        const half = col.depth * 0.5
        p1.x += col.n.x * half
        p1.y += col.n.y * half
        p2.x -= col.n.x * half
        p2.y -= col.n.y * half
        resolveCollision(p1, p2, col)
      }
    }

    // Detect fall — keep velocity so pen slides off visually
    if (!p1Fell && !isOnDesk(p1)) {
      p1Fell = true; p1FellAt = i
      finalP1 = { x: p1.x, y: p1.y, angle: p1.angle }
    }
    if (!p2Fell && !isOnDesk(p2)) {
      p2Fell = true; p2FellAt = i
      finalP2 = { x: p2.x, y: p2.y, angle: p2.angle }
    }

    // Record every 4 steps → 240/4 = 60 display frames per physics second
    if (i % 4 === 0) {
      frames.push({
        p1: { x: p1.x, y: p1.y, angle: p1.angle },
        p2: { x: p2.x, y: p2.y, angle: p2.angle },
        p1Fell, p2Fell,
      })
    }

    const p1Done = p1Fell
      ? (i - p1FellAt >= FELL_EXTRA)
      : (Math.hypot(p1.vx, p1.vy) < 0.4 && Math.abs(p1.omega) < 0.02)
    const p2Done = p2Fell
      ? (i - p2FellAt >= FELL_EXTRA)
      : (Math.hypot(p2.vx, p2.vy) < 0.4 && Math.abs(p2.omega) < 0.02)
    if (p1Done && p2Done) break
  }

  return {
    frames,
    finalP1:  finalP1 || { x: p1.x, y: p1.y, angle: p1.angle },
    finalP2:  finalP2 || { x: p2.x, y: p2.y, angle: p2.angle },
    p1Fell, p2Fell,
  }
}

// ── Computer AI ──────────────────────────────────────────────────────────────

export function computeAIFlick(myPen, theirPen, difficulty) {
  const dx   = theirPen.x - myPen.x
  const dy   = theirPen.y - myPen.y
  const base = Math.atan2(dy, dx)

  if (difficulty === 'beginner') {
    const spread = (Math.random() - 0.5) * (Math.PI / 2.2)  // ±~40°
    const power  = 0.35 + Math.random() * 0.45
    return { dir: base + spread, power }
  }
  // Advanced: aim with slight noise, calibrate power to distance
  const dist  = Math.hypot(dx, dy)
  const power = Math.min(0.92, Math.max(0.45, dist / (DESK_H * 0.55)))
  const noise = (Math.random() - 0.5) * 0.15
  return { dir: base + noise, power }
}
