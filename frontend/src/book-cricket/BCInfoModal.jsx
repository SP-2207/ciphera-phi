export default function BCInfoModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>How to Play — Book Cricket</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p>
            The classic school game! Open a book to a random page — the <strong>last digit</strong> of
            the page number is your score for that ball.
          </p>

          <div className="bc-htp-table">
            <div className="bc-htp-row bc-htp-header">
              <span>Last digit</span><span>Result</span>
            </div>
            {[
              ['1, 2, 3, 4, 6', 'Runs scored'],
              ['7 or 8', 'Dot ball (0 runs)'],
              ['0', 'Out! (or −5 in Batsman Overs)'],
              ['5', 'No Ball — +1 run, extra delivery'],
              ['9', 'Wide — +1 run, extra delivery'],
            ].map(([digit, result]) => (
              <div key={digit} className="bc-htp-row">
                <span className="bc-htp-digit">{digit}</span>
                <span>{result}</span>
              </div>
            ))}
          </div>

          <div className="modal-modes" style={{ marginTop: '0.5rem' }}>
            <h3>Formats</h3>
            <div className="mode-info-row">
              <span className="mode-badge" style={{ background: '#b59f3b' }}>Limited</span>
              <span>Fixed number of overs. Lose all wickets or run out of overs to end innings.</span>
            </div>
            <div className="mode-info-row">
              <span className="mode-badge" style={{ background: '#818384' }}>Test</span>
              <span>Unlimited overs — innings ends only when all batsmen are out.</span>
            </div>
            <div className="mode-info-row">
              <span className="mode-badge" style={{ background: '#5865f2' }}>Bat Overs</span>
              <span>
                Each batsman gets a fixed number of overs. Getting 0 costs −5 runs (no wicket).
                Highest total wins.
              </span>
            </div>
            <div className="mode-info-row">
              <span className="mode-badge" style={{ background: '#b07a20' }}>T20 Match</span>
              <span>
                Pick a real ICC T20 WC team · 20 overs per side · one book flip = one full over.
                The page you stop on sets Ball 1; five more balls are auto-generated from it.
                Edit batting order before the match starts. Second innings chases a target to win.
                Skip Over / Skip All available during the computer's innings.
              </span>
            </div>
          </div>

          <ul className="modal-rules">
            <li>Host bats first, guest bats second (vs Friend)</li>
            <li>Teams alternate every over (limited / batsman overs)</li>
            <li>NB &amp; WD runs count to team total but not the batsman's individual score</li>
            <li>Chase target: batting team wins if they beat opponent's total</li>
            <li>T20: all 11 players bat; innings ends when all are out or 20 overs complete</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
