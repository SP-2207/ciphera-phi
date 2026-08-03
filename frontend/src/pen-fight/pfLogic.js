import { DESK_W, DESK_H, MIDLINE } from './pfPhysics'

export const ROUNDS_OPTIONS = [1, 3, 5]

// Default pen start position for each player slot
export function defaultPen(slot) {
  if (slot === 0) return { x: DESK_W / 2, y: DESK_H * 0.78, angle: 0 }
  return              { x: DESK_W / 2, y: DESK_H * 0.22, angle: 0 }
}

// Computer places randomly in its half (slot 1 = top half)
export function randomComputerPen() {
  const pad = 30
  return {
    x:     pad + Math.random() * (DESK_W - pad * 2),
    y:     pad + Math.random() * (MIDLINE - pad * 2),
    angle: (Math.random() - 0.5) * Math.PI,
  }
}

export function newGameState(p1Id, p2Id, totalRounds, firstTurnId) {
  return {
    totalRounds,
    scores:      { [p1Id]: 0, [p2Id]: 0 },
    tieRounds:   0,
    currentRound: 1,
    phase:       'placement',
    pen1:        null,
    pen2:        null,
    p1Placed:    false,
    p2Placed:    false,
    firstTurn:   firstTurnId,
    currentTurn: null,
    lastResult:  null,
    lastFlick:   null,
  }
}

// Called after a round ends to start the next one (swaps who goes first each round)
export function startNextRound(state, p1Id, p2Id) {
  const newFirst = state.firstTurn === p1Id ? p2Id : p1Id
  return {
    ...state,
    currentRound: state.currentRound + 1,
    phase:        'placement',
    pen1:         null,
    pen2:         null,
    p1Placed:     false,
    p2Placed:     false,
    firstTurn:    newFirst,
    currentTurn:  null,
    lastResult:   null,
    lastFlick:    null,
  }
}

// Tie round (both pens fell): replay same round number, swap first turn
export function replayRound(state, p1Id, p2Id) {
  const newFirst = state.firstTurn === p1Id ? p2Id : p1Id
  return {
    ...state,
    tieRounds:   state.tieRounds + 1,
    phase:       'placement',
    pen1:        null,
    pen2:        null,
    p1Placed:    false,
    p2Placed:    false,
    firstTurn:   newFirst,
    currentTurn: null,
    lastResult:  null,
    lastFlick:   null,
  }
}

// Apply physics result after a flick, returns updated gameState
export function applyFlickResult(state, p1Id, p2Id, finalP1, finalP2, p1Fell, p2Fell) {
  const scores = { ...state.scores }
  const roundOver = p1Fell || p2Fell

  const newState = {
    ...state,
    pen1:       finalP1,
    pen2:       finalP2,
    lastResult: { p1Fell, p2Fell, roundOver },
  }

  if (!roundOver) {
    // Continue: switch turns
    const nextTurn = state.currentTurn === p1Id ? p2Id : p1Id
    return { ...newState, currentTurn: nextTurn }
  }

  // Tie round (both fell): no score update, signal for replay
  if (p1Fell && p2Fell) {
    return { ...newState, scores }
  }

  // One fell: update scores
  if (p1Fell)  scores[p2Id] = (scores[p2Id] || 0) + 1
  if (p2Fell)  scores[p1Id] = (scores[p1Id] || 0) + 1

  const maxScore   = Math.max(...Object.values(scores))
  const winsNeeded = Math.ceil(state.totalRounds / 2)
  const gameOver   = maxScore >= winsNeeded || state.currentRound >= state.totalRounds

  return { ...newState, scores, phase: gameOver ? 'done' : state.phase, currentTurn: null }
}

// Determine game winner (null = tie)
export function getGameWinner(state, p1Id, p2Id) {
  const s1 = state.scores[p1Id] || 0
  const s2 = state.scores[p2Id] || 0
  if (s1 > s2) return p1Id
  if (s2 > s1) return p2Id
  return null
}
