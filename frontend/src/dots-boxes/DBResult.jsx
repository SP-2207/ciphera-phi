import { PLAYER_COLORS } from './dbLogic'

const MEDALS = ['🥇', '🥈', '🥉']

export default function DBResult({ players, scores, onPlayAgain, onHome }) {
  const ranked = [...players]
    .map(p => ({ ...p, score: scores[p.id] || 0 }))
    .sort((a, b) => b.score - a.score)

  const winner     = ranked[0]
  const winnerSlot = players.findIndex(p => p.id === winner?.id)
  const winColor   = PLAYER_COLORS[winnerSlot] || '#e74c3c'

  const topScore = ranked[0]?.score ?? 0
  const ties     = ranked.filter(p => p.score === topScore)
  const bannerText = ties.length > 1
    ? `Tie! ${ties.map(p => p.initials).join(' & ')} — ${topScore} boxes each`
    : `${winner?.initials} wins with ${topScore} boxes!`

  return (
    <div className="game">
      <div className="header">
        <div className="header-left" />
        <h1>Dots &amp; Boxes</h1>
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
            const color = PLAYER_COLORS[slot] || '#888'
            return (
              <div key={p.id} className="db-result-row">
                <span className="db-result-rank">{MEDALS[i] || `#${i + 1}`}</span>
                <span className="db-result-initials" style={{ color }}>{p.initials}</span>
                <span className="db-result-label">{p.isComputer ? 'CPU' : ''}</span>
                <span className="db-result-score">{p.score} boxes</span>
              </div>
            )
          })}
        </div>

        <div className="db-result-actions">
          <button className="accept-btn" onClick={onPlayAgain}>Play Again</button>
          <button className="icon-btn" style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }} onClick={onHome}>
            Hub
          </button>
        </div>
      </div>
    </div>
  )
}
