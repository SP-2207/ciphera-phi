const PLAYER_COLORS = ['#c0392b', '#1a6faf']
const MEDALS = ['🥇', '🥈']

export default function PFResult({ players, scores, onPlayAgain, onHome }) {
  const ranked   = [...players]
    .map(p => ({ ...p, score: scores[p.id] || 0 }))
    .sort((a, b) => b.score - a.score)

  const topScore = ranked[0]?.score ?? 0
  const winners  = ranked.filter(p => p.score === topScore)
  const isTie    = winners.length > 1

  const winner     = ranked[0]
  const winnerSlot = players.findIndex(p => p.id === winner?.id)
  const winColor   = PLAYER_COLORS[winnerSlot] ?? '#e74c3c'

  const bannerText = isTie
    ? `Tie! ${winners.map(p => p.initials).join(' & ')} — ${topScore} round${topScore !== 1 ? 's' : ''} each`
    : `${winner?.initials} wins with ${topScore} round${topScore !== 1 ? 's' : ''}!`

  return (
    <div className="game">
      <div className="header">
        <div className="header-left" />
        <h1>Pen Fight</h1>
        <div className="header-right" />
      </div>

      <div className="db-result">
        <div
          className="db-result-banner"
          style={{ '--win-color': winColor, borderColor: winColor, color: winColor }}
        >
          {bannerText}
        </div>

        <div className="db-result-table">
          {ranked.map((p, i) => {
            const slot  = players.findIndex(pl => pl.id === p.id)
            const color = PLAYER_COLORS[slot] ?? '#888'
            return (
              <div key={p.id} className="db-result-row">
                <span className="db-result-rank">{MEDALS[i] ?? `#${i + 1}`}</span>
                <span className="db-result-initials" style={{ color }}>{p.initials}</span>
                <span className="db-result-label">{p.isComputer ? 'CPU' : ''}</span>
                <span className="db-result-score">
                  {p.score} round{p.score !== 1 ? 's' : ''}
                </span>
              </div>
            )
          })}
        </div>

        <div className="db-result-actions">
          <button className="accept-btn" onClick={onPlayAgain}>Play Again</button>
          <button
            className="icon-btn"
            style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}
            onClick={onHome}
          >
            Hub
          </button>
        </div>
      </div>
    </div>
  )
}
