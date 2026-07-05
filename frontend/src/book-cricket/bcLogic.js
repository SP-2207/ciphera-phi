export const MAX_BATSMEN = 4
export const BOOK_PAGES = 500

export function getScore(page) {
  const u = page % 10
  if (u === 0) return { runs: 0, wicket: true,  dot: false }
  if (u >= 7)  return { runs: 0, wicket: false, dot: true  }
  return           { runs: u, wicket: false, dot: false }
}

export function newTeamState(names = []) {
  return {
    batsmen: Array.from({ length: MAX_BATSMEN }, (_, i) => ({
      name: (names[i] || '').trim() || `Bat ${i + 1}`,
      runs: 0, balls: 0, out: false,
    })),
    currentBatsman: 0,
    totalRuns:      0,
    totalBalls:     0,
    wickets:        0,
    history:        [],   // [{ page, runs, wicket, dot }, ...]
    done:           false,
  }
}

export function applyFlip(team, page, maxBalls) {
  const { runs, wicket, dot } = getScore(page)

  const batsmen = team.batsmen.map((b, i) => {
    if (i !== team.currentBatsman) return b
    return { ...b, runs: b.runs + runs, balls: b.balls + 1, out: wicket }
  })

  const nextBatsman = wicket ? team.currentBatsman + 1 : team.currentBatsman
  const totalBalls  = team.totalBalls + 1
  const totalRuns   = team.totalRuns  + runs
  const wickets     = team.wickets    + (wicket ? 1 : 0)
  const allOut      = nextBatsman >= MAX_BATSMEN
  const oversUp     = totalBalls >= maxBalls

  return {
    batsmen,
    currentBatsman: nextBatsman,
    totalRuns,
    totalBalls,
    wickets,
    history: [...team.history, { page, runs, wicket, dot }],
    done:    allOut || oversUp,
  }
}

// Returns 0 (team0's turn) or 1 (team1's turn) or null (both done).
// Team 0 always bats first each over.
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
