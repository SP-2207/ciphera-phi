export const MAX_BATSMEN = 4
export const BOOK_PAGES  = 500

/**
 * Scoring per last digit of page number.
 * isBOMode: "Batsman-Overs" format — digit 0 gives -5 (no dismissal) instead of a wicket.
 */
export function getScore(page, isBOMode = false) {
  const u = page % 10
  if (u === 5) return { runs: 1,  extra: true,  extraType: 'nb', wicket: false, dot: false }
  if (u === 9) return { runs: 1,  extra: true,  extraType: 'wd', wicket: false, dot: false }
  if (u === 0) {
    if (isBOMode) return { runs: -5, extra: false, extraType: null, wicket: false, dot: false }
    return           { runs: 0,  extra: false, extraType: null, wicket: true,  dot: false }
  }
  if (u === 7 || u === 8)
    return { runs: 0, extra: false, extraType: null, wicket: false, dot: true  }
  return   { runs: u, extra: false, extraType: null, wicket: false, dot: false }
}

/** Create initial team state. names array, batsman count (2–6). */
export function newTeamState(names = [], count = MAX_BATSMEN) {
  const n = Math.max(2, Math.min(6, count || MAX_BATSMEN))
  return {
    batsmen: Array.from({ length: n }, (_, i) => ({
      name: (names[i] || '').trim() || `Bat ${i + 1}`,
      runs: 0, balls: 0, out: false,
    })),
    currentBatsman: 0,
    totalRuns:      0,
    totalBalls:     0,
    wickets:        0,
    history:        [],
    done:           false,
  }
}

/**
 * Apply one flip to a team state.
 * maxBalls  – total valid deliveries allowed (Infinity for test / batsman-overs).
 * batsmanOvers – if non-null, "Batsman-Overs" format: batsman rotates after this many overs.
 */
export function applyFlip(team, page, maxBalls, batsmanOvers = null) {
  const isBOMode = batsmanOvers !== null
  const { runs, extra, extraType, wicket, dot } = getScore(page, isBOMode)

  const cur = team.batsmen[team.currentBatsman]
  const updatedBat = {
    ...cur,
    runs:  cur.runs  + runs,
    balls: extra ? cur.balls : cur.balls + 1,
    out:   wicket,
  }

  // Determine whether the current batsman's innings is over
  let nextBatsman = team.currentBatsman
  if (wicket) {
    nextBatsman = team.currentBatsman + 1
  } else if (isBOMode && !extra && updatedBat.balls >= batsmanOvers * 6) {
    nextBatsman = team.currentBatsman + 1   // rotates to next, not "out"
  }

  const batsmen    = team.batsmen.map((b, i) => i === team.currentBatsman ? updatedBat : b)
  const totalBalls = extra ? team.totalBalls : team.totalBalls + 1
  const totalRuns  = team.totalRuns + runs
  const wickets    = team.wickets   + (wicket ? 1 : 0)
  const allOut     = nextBatsman >= batsmen.length
  const oversUp    = totalBalls >= maxBalls

  return {
    batsmen,
    currentBatsman: nextBatsman,
    totalRuns,
    totalBalls,
    wickets,
    history: [...team.history, { page, runs, wicket, dot, extra, extraType }],
    done: allOut || oversUp,
  }
}

/**
 * Returns whose turn it is.
 * 0 = team-0 (host), 1 = team-1 (guest/computer), null = both done.
 * Team-0 always bats first each over.
 */
export function getActiveTurn(t0, t1) {
  if (t0.done && t1.done) return null
  if (t0.done) return 1
  if (t1.done) return 0
  const o0 = Math.floor(t0.totalBalls / 6)
  const o1 = Math.floor(t1.totalBalls / 6)
  return o0 > o1 ? 1 : 0
}

export function oversLabel(totalBalls) {
  return `${Math.floor(totalBalls / 6)}.${totalBalls % 6}`
}
