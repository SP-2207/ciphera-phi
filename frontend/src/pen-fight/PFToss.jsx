import { useState, useEffect } from 'react'

// Coin flip toss — same mechanic as Book Cricket
// mode='computer': human always picks, result is random
// mode='friend':   host picks, both see result via props
export default function PFToss({
  mode,
  players,         // [{id, initials, slot, isHost}]
  myPlayerId,
  tossData,        // null | { call, result, winner } — for friend mode
  onCallToss,      // (call: 'heads'|'tails') => void — host calls
  onTossComplete,  // (winnerId) => void
}) {
  const [call,       setCall]       = useState(null)      // 'heads' | 'tails'
  const [result,     setResult]     = useState(null)      // 'heads' | 'tails'
  const [flipping,   setFlipping]   = useState(false)
  const [winnerId,   setWinnerId]   = useState(null)

  const me     = players.find(p => p.id === myPlayerId)
  const isHost = me?.isHost || mode === 'computer'

  // ── vs Computer: local toss flow ─────────────────────────────────────────
  function pickCall(c) {
    setCall(c)
    setFlipping(true)
    setTimeout(() => {
      const res    = Math.random() < 0.5 ? 'heads' : 'tails'
      const winner = res === c ? myPlayerId : 'cpu'
      setResult(res)
      setWinnerId(winner)
      setFlipping(false)
    }, 1000)
  }

  // ── vs Friend: host picks call → onCallToss; both watch tossData ─────────
  useEffect(() => {
    if (mode !== 'friend' || !tossData?.result) return
    setCall(tossData.call)
    setResult(tossData.result)
    setFlipping(false)
    setWinnerId(tossData.winner)
  }, [tossData, mode]) // eslint-disable-line

  // Friend mode: host picks → triggers Firebase write
  function hostPick(c) {
    if (!isHost || call) return
    setCall(c)
    setFlipping(true)
    const res    = Math.random() < 0.5 ? 'heads' : 'tails'
    const winner = res === c ? myPlayerId : players.find(p => !p.isHost)?.id || myPlayerId
    setTimeout(() => onCallToss(c, res, winner), 900)
  }

  const winnerPlayer = players.find(p => p.id === winnerId)
  const winnerLabel  = winnerId === myPlayerId
    ? 'You win the toss!'
    : winnerId === 'cpu'
      ? 'CPU wins the toss!'
      : `${winnerPlayer?.initials || '?'} wins the toss!`

  return (
    <div className="game pf-toss-screen">
      <div className="header">
        <div className="header-left" />
        <h1>Pen Fight — Toss</h1>
        <div className="header-right" />
      </div>

      <div className="pf-toss-body">
        {/* Coin */}
        <div className={`pf-coin${flipping ? ' pf-coin--flip' : ''}`}>
          {!flipping && result ? (
            <span className="pf-coin-face">{result === 'heads' ? 'H' : 'T'}</span>
          ) : (
            <span className="pf-coin-face">?</span>
          )}
        </div>

        {!call && !flipping && (
          <>
            {isHost || mode === 'computer' ? (
              <>
                <p className="pf-toss-label">Call it!</p>
                <div className="pf-toss-btns">
                  <button
                    className="accept-btn"
                    onClick={() => mode === 'computer' ? pickCall('heads') : hostPick('heads')}
                  >
                    Heads
                  </button>
                  <button
                    className="accept-btn"
                    onClick={() => mode === 'computer' ? pickCall('tails') : hostPick('tails')}
                    style={{ background: '#3498db' }}
                  >
                    Tails
                  </button>
                </div>
              </>
            ) : (
              <p className="pf-toss-label">
                {players.find(p => p.isHost)?.initials || 'Host'} is calling…
              </p>
            )}
          </>
        )}

        {flipping && (
          <p className="pf-toss-label">Flipping…</p>
        )}

        {result && !flipping && (
          <div className="pf-toss-result">
            <p className="pf-toss-call">
              Called: <strong>{call}</strong> — Result: <strong>{result}</strong>
            </p>
            <p className="pf-toss-winner">{winnerLabel}</p>
            <p className="pf-toss-sub">Winner places their pen first</p>
            <button
              className="accept-btn"
              style={{ marginTop: '1.5rem' }}
              onClick={() => onTossComplete(winnerId)}
            >
              Place Pens →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
