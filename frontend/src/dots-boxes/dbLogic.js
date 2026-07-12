export const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12']

// Derive grid dimensions from dot count
function grid(dots) {
  const cells    = dots - 1
  const hCount   = dots * cells
  const vCount   = cells * dots
  const boxCount = cells * cells
  return { cells, hCount, vCount, boxCount }
}

// ── State factory ─────────────────────────────────────────────────────────────

export function newGameState(playerIds, dots = 10) {
  const { hCount, vCount, boxCount } = grid(dots)
  return {
    dots,
    hLines:        Array(hCount).fill(null),
    vLines:        Array(vCount).fill(null),
    boxes:         Array(boxCount).fill(null),
    scores:        Object.fromEntries(playerIds.map(id => [id, 0])),
    currentSlot:   0,
    moveCount:     0,
    phase:         'playing',
    turnStartedAt: Date.now(),
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function affectedBoxes(type, idx, dots, cells) {
  const result = []
  if (type === 'h') {
    const r = Math.floor(idx / cells)
    const c = idx % cells
    if (r > 0)     result.push((r - 1) * cells + c)
    if (r < cells) result.push(r * cells + c)
  } else {
    const r = Math.floor(idx / dots)
    const c = idx % dots
    if (c > 0)     result.push(r * cells + (c - 1))
    if (c < cells) result.push(r * cells + c)
  }
  return result
}

function sidesDrawn(hLines, vLines, bi, dots, cells) {
  const r = Math.floor(bi / cells)
  const c = bi % cells
  let n = 0
  if (hLines[r       * cells + c  ]) n++
  if (hLines[(r + 1) * cells + c  ]) n++
  if (vLines[r       * dots  + c  ]) n++
  if (vLines[r       * dots  + c+1]) n++
  return n
}

// ── applyMove ─────────────────────────────────────────────────────────────────

export function applyMove(state, type, idx, playerId) {
  const dots = state.dots || 10
  const { cells, hCount, vCount, boxCount } = grid(dots)

  if (type !== 'h' && type !== 'v') return null
  if (type === 'h') {
    if (idx < 0 || idx >= hCount || state.hLines[idx]) return null
  } else {
    if (idx < 0 || idx >= vCount || state.vLines[idx]) return null
  }

  const newH      = [...state.hLines]
  const newV      = [...state.vLines]
  const newB      = [...state.boxes]
  const newScores = { ...state.scores }

  if (type === 'h') newH[idx] = playerId
  else              newV[idx] = playerId

  let captured = 0
  for (const bi of affectedBoxes(type, idx, dots, cells)) {
    if (newB[bi]) continue
    const r = Math.floor(bi / cells), c = bi % cells
    if (newH[r*cells+c] && newH[(r+1)*cells+c] && newV[r*dots+c] && newV[r*dots+(c+1)]) {
      newB[bi] = playerId
      newScores[playerId] = (newScores[playerId] || 0) + 1
      captured++
    }
  }

  const totalClaimed = newB.filter(Boolean).length
  return {
    state: {
      ...state,
      hLines:        newH,
      vLines:        newV,
      boxes:         newB,
      scores:        newScores,
      moveCount:     state.moveCount + 1,
      phase:         totalClaimed >= boxCount ? 'done' : 'playing',
      turnStartedAt: Date.now(),
    },
    captured,
    bonusTurn: captured > 0,
  }
}

// ── AI ────────────────────────────────────────────────────────────────────────

function availableMoves(state) {
  const dots = state.dots || 10
  const { cells, hCount, vCount } = grid(dots)
  const moves = []
  for (let i = 0; i < hCount; i++) if (!state.hLines[i]) moves.push({ type: 'h', idx: i })
  for (let i = 0; i < vCount; i++) if (!state.vLines[i]) moves.push({ type: 'v', idx: i })
  return moves
}

function movesFor3Created(state, move) {
  const dots = state.dots || 10
  const cells = dots - 1
  let n = 0
  for (const bi of affectedBoxes(move.type, move.idx, dots, cells)) {
    if (!state.boxes[bi] && sidesDrawn(state.hLines, state.vLines, bi, dots, cells) === 2) n++
  }
  return n
}

/**
 * Both difficulties always complete a box when possible (greedy capture).
 * Beginner: otherwise random — may gift boxes to opponent.
 * Advanced:  otherwise avoids creating 3-sided boxes; if forced, sacrifices the smallest chain.
 */
export function computeMove(state, difficulty) {
  if (!state || state.phase !== 'playing') return null
  const moves = availableMoves(state)
  if (!moves.length) return null

  const dots  = state.dots || 10
  const cells = dots - 1

  // Priority 1 (both levels): complete any available box
  for (const move of moves) {
    for (const bi of affectedBoxes(move.type, move.idx, dots, cells)) {
      if (!state.boxes[bi] && sidesDrawn(state.hLines, state.vLines, bi, dots, cells) === 3) {
        return move
      }
    }
  }

  // Beginner: random from remaining (doesn't think ahead)
  if (difficulty === 'beginner') {
    return moves[Math.floor(Math.random() * moves.length)]
  }

  // Advanced — Priority 2: safe move (doesn't leave a 3-sided box)
  const safe = moves.filter(m => movesFor3Created(state, m) === 0)
  if (safe.length) return safe[Math.floor(Math.random() * safe.length)]

  // Advanced — Priority 3: sacrifice minimum 3-sided boxes
  let best = null, bestN = Infinity
  for (const m of moves) {
    const n = movesFor3Created(state, m)
    if (n < bestN) { bestN = n; best = m }
  }
  return best || moves[0]
}
