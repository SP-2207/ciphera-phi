// ── Constants ────────────────────────────────────────────────────────────────
export const DOTS        = 10
export const CELLS       = 9           // DOTS - 1
export const H_COUNT     = DOTS * CELLS  // 90  horizontal lines
export const V_COUNT     = CELLS * DOTS  // 90  vertical lines
export const BOX_COUNT   = CELLS * CELLS // 81  boxes

export const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12']

// ── State factory ────────────────────────────────────────────────────────────
/**
 * Create a fresh game state.
 * @param {string[]} playerIds - ordered array of player IDs (slot 0 goes first)
 */
export function newGameState(playerIds) {
  return {
    hLines:        Array(H_COUNT).fill(null),
    vLines:        Array(V_COUNT).fill(null),
    boxes:         Array(BOX_COUNT).fill(null),
    scores:        Object.fromEntries(playerIds.map(id => [id, 0])),
    currentSlot:   0,
    moveCount:     0,
    phase:         'playing',
    turnStartedAt: Date.now(),
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Return box flat-indices affected by a given line draw. */
function affectedBoxes(type, idx) {
  const result = []
  if (type === 'h') {
    const r = Math.floor(idx / CELLS)
    const c = idx % CELLS
    if (r > 0)     result.push((r - 1) * CELLS + c)
    if (r < CELLS) result.push(r * CELLS + c)
  } else {
    const r = Math.floor(idx / DOTS)
    const c = idx % DOTS
    if (c > 0)     result.push(r * CELLS + (c - 1))
    if (c < CELLS) result.push(r * CELLS + c)
  }
  return result
}

/** Count how many sides box bi already has drawn. */
function sidesDrawn(hLines, vLines, bi) {
  const r = Math.floor(bi / CELLS)
  const c = bi % CELLS
  let n = 0
  if (hLines[r * CELLS + c])         n++
  if (hLines[(r + 1) * CELLS + c])   n++
  if (vLines[r * DOTS + c])          n++
  if (vLines[r * DOTS + (c + 1)])    n++
  return n
}

// ── applyMove ────────────────────────────────────────────────────────────────
/**
 * Apply a move.
 * Returns { state, captured, bonusTurn } or null if invalid.
 */
export function applyMove(state, type, idx, playerId) {
  if (type !== 'h' && type !== 'v') return null
  if (type === 'h') {
    if (idx < 0 || idx >= H_COUNT) return null
    if (state.hLines[idx])         return null
  } else {
    if (idx < 0 || idx >= V_COUNT) return null
    if (state.vLines[idx])         return null
  }

  const newH      = [...state.hLines]
  const newV      = [...state.vLines]
  const newB      = [...state.boxes]
  const newScores = { ...state.scores }

  if (type === 'h') newH[idx] = playerId
  else              newV[idx] = playerId

  let captured = 0
  for (const bi of affectedBoxes(type, idx)) {
    if (newB[bi]) continue
    const r      = Math.floor(bi / CELLS)
    const c      = bi % CELLS
    const top    = newH[r * CELLS + c]
    const bottom = newH[(r + 1) * CELLS + c]
    const left   = newV[r * DOTS + c]
    const right  = newV[r * DOTS + (c + 1)]
    if (top && bottom && left && right) {
      newB[bi] = playerId
      newScores[playerId] = (newScores[playerId] || 0) + 1
      captured++
    }
  }

  const totalClaimed = newB.filter(Boolean).length
  const phase        = totalClaimed >= BOX_COUNT ? 'done' : 'playing'

  return {
    state: {
      hLines:        newH,
      vLines:        newV,
      boxes:         newB,
      scores:        newScores,
      currentSlot:   state.currentSlot,
      moveCount:     state.moveCount + 1,
      phase,
      turnStartedAt: Date.now(),
    },
    captured,
    bonusTurn: captured > 0,
  }
}

// ── AI ───────────────────────────────────────────────────────────────────────

function getAvailableMoves(state) {
  const moves = []
  for (let i = 0; i < H_COUNT; i++) {
    if (!state.hLines[i]) moves.push({ type: 'h', idx: i })
  }
  for (let i = 0; i < V_COUNT; i++) {
    if (!state.vLines[i]) moves.push({ type: 'v', idx: i })
  }
  return moves
}

/** Count 3-sided boxes that would be created by this move (giving away captures). */
function countThreeSidesCreated(state, move) {
  let count = 0
  for (const bi of affectedBoxes(move.type, move.idx)) {
    if (!state.boxes[bi] && sidesDrawn(state.hLines, state.vLines, bi) === 2) count++
  }
  return count
}

/**
 * Compute the best move for the computer.
 *
 * Beginner: random move.
 * Advanced:
 *   1. Complete a box (4th side)
 *   2. Safe move (doesn't create any 3-sided box)
 *   3. Sacrifice move minimising 3-sided boxes created
 */
export function computeMove(state, difficulty) {
  if (!state || state.phase !== 'playing') return null
  const moves = getAvailableMoves(state)
  if (moves.length === 0) return null

  if (difficulty === 'beginner') {
    return moves[Math.floor(Math.random() * moves.length)]
  }

  // Priority 1: complete a box
  for (const move of moves) {
    for (const bi of affectedBoxes(move.type, move.idx)) {
      if (!state.boxes[bi] && sidesDrawn(state.hLines, state.vLines, bi) === 3) {
        return move
      }
    }
  }

  // Priority 2: safe move (creates no 3-sided box)
  const safeMoves = moves.filter(m => countThreeSidesCreated(state, m) === 0)
  if (safeMoves.length > 0) {
    return safeMoves[Math.floor(Math.random() * safeMoves.length)]
  }

  // Priority 3: minimise 3-sided boxes created
  let best = null
  let bestCount = Infinity
  for (const move of moves) {
    const n = countThreeSidesCreated(state, move)
    if (n < bestCount) { bestCount = n; best = move }
  }
  return best || moves[0]
}
