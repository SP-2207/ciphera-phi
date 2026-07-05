export const MAX_BATSMEN = 4
export const BOOK_PAGES  = 500

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

export function newTeamState(names = [], count = MAX_BATSMEN) {
  const n = Math.max(2, Math.min(6, count || MAX_BATSMEN))
  return {
    batsmen: Array.from({ length: n }, (_, i) => ({
      name: (names[i] || '').trim() || `Bat ${i + 1}`,
      runs: 0, balls: 0, out: false,
    })),
    currentBatsman: 0,
    totalRuns:  0,
    totalBalls: 0,
    wickets:    0,
    nbRuns:     0,   // extra runs from no-balls
    wdRuns:     0,   // extra runs from wides
    history:    [],
    done:       false,
  }
}

export function applyFlip(team, page, maxBalls, batsmanOvers = null) {
  const isBOMode = batsmanOvers !== null
  const { runs, extra, extraType, wicket, dot } = getScore(page, isBOMode)

  const cur = team.batsmen[team.currentBatsman]

  // Extras (NB/WD): runs go to team total only, NOT the batsman's individual score.
  // Ball also doesn't count as an official delivery.
  const updatedBat = {
    ...cur,
    runs:  extra ? cur.runs : cur.runs + runs,
    balls: extra ? cur.balls : cur.balls + 1,
    out:   wicket,
  }

  // Batsman rotation
  let nextBatsman = team.currentBatsman
  if (wicket) {
    nextBatsman = team.currentBatsman + 1
  } else if (isBOMode && !extra && updatedBat.balls >= batsmanOvers * 6) {
    nextBatsman = team.currentBatsman + 1
  }

  const batsmen    = team.batsmen.map((b, i) => i === team.currentBatsman ? updatedBat : b)
  const totalBalls = extra ? team.totalBalls : team.totalBalls + 1
  const totalRuns  = team.totalRuns + runs          // extras DO count toward team score
  const wickets    = team.wickets   + (wicket ? 1 : 0)
  const nbRuns     = team.nbRuns    + (extraType === 'nb' ? runs : 0)
  const wdRuns     = team.wdRuns    + (extraType === 'wd' ? runs : 0)
  const allOut     = nextBatsman >= batsmen.length
  const oversUp    = totalBalls >= maxBalls

  return {
    batsmen,
    currentBatsman: nextBatsman,
    totalRuns,
    totalBalls,
    wickets,
    nbRuns,
    wdRuns,
    history: [...team.history, { page, runs, wicket, dot, extra, extraType }],
    done: allOut || oversUp,
  }
}

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

// Returns correct this-over and prev-over entries from history,
// accounting for extras (which appear in history but don't increment totalBalls).
export function getOverHistory(history, totalBalls) {
  if (history.length === 0) return { thisOver: [], prevOver: [] }

  // Tag each entry with the over it was bowled in (0-indexed).
  // An extra belongs to the over that was "active" before it was bowled.
  let runningValid = 0
  const tagged = history.map(entry => {
    const overNum = Math.floor(runningValid / 6)
    if (!entry.extra) runningValid++
    return { entry, overNum }
  })

  // Current over index: if mid-over use that over; if exactly on boundary
  // (over just completed), show last over as "prev" and current as empty.
  const onBoundary = totalBalls > 0 && totalBalls % 6 === 0
  const currentOverNum = onBoundary
    ? Math.floor(totalBalls / 6)          // new over not started yet
    : totalBalls === 0 ? 0
    : Math.floor((totalBalls - 1) / 6)

  const thisOver = onBoundary
    ? []
    : tagged.filter(t => t.overNum === currentOverNum).map(t => t.entry)
  const prevOverNum = onBoundary ? currentOverNum - 1 : currentOverNum - 1
  const prevOver = tagged.filter(t => t.overNum === prevOverNum).map(t => t.entry)

  return { thisOver, prevOver }
}
