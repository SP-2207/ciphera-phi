import { getScore } from './bcLogic'

export const T20_OVERS     = 20
export const T20_MAX_BALLS = T20_OVERS * 6
export const BOOK_PAGES    = 500

export function newT20State(players) {
  return {
    batsmen: players.map(p => ({
      name:    p.name,
      captain: !!p.captain,
      wk:      !!p.wk,
      runs:    0,
      balls:   0,
      fours:   0,
      sixes:   0,
      out:     false,
    })),
    currentBatsman: 0,
    totalRuns:      0,
    totalBalls:     0,
    wickets:        0,
    nbRuns:         0,
    wdRuns:         0,
    overs:          [],   // [{balls:[...], runs:N}, ...]
    done:           false,
  }
}

// Apply a single delivery to the state.
export function applyT20Ball(state, page, target = null) {
  const { runs, extra, extraType, wicket } = getScore(page, false)

  const cur = state.batsmen[state.currentBatsman]
  const updatedBat = {
    ...cur,
    runs:  extra ? cur.runs  : cur.runs  + runs,
    balls: extra ? cur.balls : cur.balls + 1,
    fours: !extra && runs === 4 ? cur.fours + 1 : cur.fours,
    sixes: !extra && runs === 6 ? cur.sixes + 1 : cur.sixes,
    out:   wicket ? true : cur.out,
  }

  const nextBatsman =
    wicket && state.currentBatsman < state.batsmen.length - 1
      ? state.currentBatsman + 1
      : state.currentBatsman

  const batsmen    = state.batsmen.map((b, i) => i === state.currentBatsman ? updatedBat : b)
  const totalBalls = extra ? state.totalBalls : state.totalBalls + 1
  const totalRuns  = state.totalRuns + runs
  const wickets    = state.wickets   + (wicket ? 1 : 0)
  const nbRuns     = state.nbRuns    + (extraType === 'nb' ? runs : 0)
  const wdRuns     = state.wdRuns    + (extraType === 'wd' ? runs : 0)

  const allOut    = wickets >= 10
  const oversUp   = totalBalls >= T20_MAX_BALLS
  const wonChase  = target !== null && totalRuns >= target

  return {
    newState: {
      ...state,
      batsmen,
      currentBatsman: nextBatsman,
      totalRuns,
      totalBalls,
      wickets,
      nbRuns,
      wdRuns,
      done: allOut || oversUp || wonChase,
    },
    ball: { page, runs, extra, extraType, wicket, dot: !wicket && !extra && runs === 0 },
  }
}

// Apply one full over (6 valid balls + any extras).
// anchorPage is ball 1; remaining are random.
// target: if the chasing team reaches it, the over stops early.
export function applyT20Over(state, anchorPage, target = null) {
  const ballResults = []
  let current     = state
  let validBalls  = 0
  let isFirstBall = true
  let safety      = 60   // guard against infinite extras

  while (validBalls < 6 && !current.done && safety-- > 0) {
    const page = isFirstBall
      ? anchorPage
      : Math.floor(Math.random() * BOOK_PAGES) + 1
    isFirstBall = false

    const { newState, ball } = applyT20Ball(current, page, target)
    ballResults.push(ball)
    current = newState
    if (!ball.extra) validBalls++
  }

  const overRuns = ballResults.reduce((s, b) => s + b.runs, 0)
  return {
    newState: {
      ...current,
      overs: [...current.overs, { balls: ballResults, runs: overRuns }],
    },
    ballResults,
  }
}

export function oversLabel(totalBalls) {
  return `${Math.floor(totalBalls / 6)}.${totalBalls % 6}`
}

export function runRate(totalRuns, totalBalls) {
  if (totalBalls === 0) return '0.00'
  return ((totalRuns / totalBalls) * 6).toFixed(2)
}

export function requiredRunRate(runsNeeded, ballsLeft) {
  if (ballsLeft <= 0) return '∞'
  return ((runsNeeded / ballsLeft) * 6).toFixed(2)
}
