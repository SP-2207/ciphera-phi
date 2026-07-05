import { oversLabel } from './bcLogic'

function BatsmanRow({ b }) {
  return (
    <div className={`bc-batsman-row${b.out ? ' bc-bat--out' : ''}`}>
      <span className="bc-bat-name">{b.name}</span>
      <span className={`bc-bat-score${b.runs < 0 ? ' bc-runs-neg' : ''}`}>
        {b.runs} <span className="bc-bat-balls">({b.balls}b)</span>
      </span>
      {b.out && <span className="bc-out-tag">out</span>}
    </div>
  )
}

export default function BCResult({
  myTeam, oppTeam, opponent, format, overs, batsmanOvers,
  onPlayAgain, onHome,
}) {
  const oppLabel = opponent === 'computer' ? 'Computer' : 'Opponent'

  const myRuns  = myTeam.totalRuns
  const oppRuns = oppTeam.totalRuns
  const diff    = Math.abs(myRuns - oppRuns)

  let verdict, verdictClass
  if (myRuns > oppRuns) {
    verdict = `You won by ${diff} run${diff !== 1 ? 's' : ''}!`
    verdictClass = 'bc-verdict--win'
  } else if (myRuns < oppRuns) {
    verdict = `${oppLabel} won by ${diff} run${diff !== 1 ? 's' : ''}`
    verdictClass = 'bc-verdict--loss'
  } else {
    verdict = "It's a tie!"
    verdictClass = 'bc-verdict--tie'
  }

  function formatLabel() {
    if (format === 'test')          return 'Test Match'
    if (format === 'batsman-overs') return `${batsmanOvers} overs per batsman`
    return `${overs}-over match`
  }

  return (
    <div className="game">
      <div className="header">
        <div className="header-left">
          <button className="icon-btn" onClick={onHome}>←</button>
        </div>
        <h1>Book Cricket</h1>
        <div className="header-right">
          <span className="mode-badge" style={{ background: format === 'test' ? '#818384' : '#b59f3b' }}>
            {format === 'test' ? 'Test' : format === 'batsman-overs' ? `${batsmanOvers}ov/bat` : `${overs}ov`}
          </span>
        </div>
      </div>

      <div className="bc-result">
        <div className={`bc-verdict ${verdictClass}`}>{verdict}</div>
        <p className="bc-format-label">{formatLabel()}</p>

        <div className="bc-result-panels">
          <div className="bc-result-card bc-result-card--you">
            <div className="panel-label label-you">You</div>
            <div className="bc-score-main">
              <span className={`bc-runs${myRuns < 0 ? ' bc-runs-neg' : ''}`}>{myRuns}</span>
              {format !== 'batsman-overs' && <span className="bc-wkt">/{myTeam.wickets}</span>}
            </div>
            <div className="bc-overs-line">{oversLabel(myTeam.totalBalls)} ov</div>
            <div className="bc-batsmen">
              {myTeam.batsmen.map((b, i) => <BatsmanRow key={i} b={b} />)}
            </div>
          </div>

          <div className="bc-result-card bc-result-card--opp">
            <div className="panel-label label-opp">{oppLabel}</div>
            <div className="bc-score-main">
              <span className={`bc-runs${oppRuns < 0 ? ' bc-runs-neg' : ''}`}>{oppRuns}</span>
              {format !== 'batsman-overs' && <span className="bc-wkt">/{oppTeam.wickets}</span>}
            </div>
            <div className="bc-overs-line">{oversLabel(oppTeam.totalBalls)} ov</div>
            <div className="bc-batsmen">
              {oppTeam.batsmen.map((b, i) => <BatsmanRow key={i} b={b} />)}
            </div>
          </div>
        </div>

        <div className="game-over-actions" style={{ marginTop: '1.5rem' }}>
          <button className="restart-btn" onClick={onPlayAgain}>Play Again</button>
          <button className="share-btn"   onClick={onHome}>← Hub</button>
        </div>
      </div>
    </div>
  )
}
