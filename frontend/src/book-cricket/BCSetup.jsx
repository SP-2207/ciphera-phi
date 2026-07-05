import { useState } from 'react'

const MIN_BAT = 2
const MAX_BAT = 6

function NamesSection({ names, count, onChange }) {
  return (
    <div className="bc-names-section">
      <p className="bc-names-hint">Name your batsmen <span>(optional)</span></p>
      <div className="bc-names-grid">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="bc-name-row">
            <label className="bc-name-label">Bat {i + 1}</label>
            <input
              type="text"
              className="bc-input bc-input--name"
              placeholder={`Batsman ${i + 1}`}
              value={names[i] || ''}
              maxLength={14}
              onChange={e => {
                const next = [...names]
                next[i] = e.target.value
                onChange(next)
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function BatsmanCountPicker({ value, onChange }) {
  return (
    <div className="bc-count-row">
      <span className="bc-count-label">Number of batsmen</span>
      <div className="bc-count-pills">
        {Array.from({ length: MAX_BAT - MIN_BAT + 1 }, (_, i) => MIN_BAT + i).map(n => (
          <button
            key={n}
            className={`bc-count-pill${value === n ? ' bc-count-pill--active' : ''}`}
            onClick={() => onChange(n)}
            type="button"
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function BCSetup({ isInvite, joinError, guestBatsmanCount, onStart, onBack }) {
  const [format,       setFormat]       = useState(null)
  const [overs,        setOvers]        = useState('')
  const [batsmanOvers, setBatsmanOvers] = useState('')
  const [batsmanCount, setBatsmanCount] = useState(4)
  const [error,        setError]        = useState('')
  const [names,        setNames]        = useState(Array(MAX_BAT).fill(''))

  // ── Guest invite flow ────────────────────────────────
  if (isInvite) {
    const guestCount = guestBatsmanCount || 4
    return (
      <div className="game">
        <div className="header">
          <div className="header-left">
            <button className="icon-btn" onClick={onBack}>←</button>
          </div>
          <h1>Book Cricket</h1>
          <div className="header-right" />
        </div>
        <div className="bc-home">
          <div className="invite-card">
            <div className="invite-icon">🏏</div>
            <h2>You've been challenged!</h2>
            <p>A friend invited you to a Book Cricket match.</p>
            <NamesSection names={names} count={guestCount} onChange={setNames} />
            {joinError && <p className="error" style={{ marginTop: '0.5rem' }}>{joinError}</p>}
            <button className="accept-btn" onClick={() => onStart(null, 0, 0, names, guestCount)}>
              Accept Challenge
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Host setup flow ──────────────────────────────────
  function handleStart() {
    if (!format) { setError('Pick a format first'); return }

    if (format === 'limited') {
      const n = parseInt(overs, 10)
      if (!n || n < 1 || n > 50) { setError('Enter overs between 1 and 50'); return }
      onStart('limited', n, 0, names, batsmanCount)

    } else if (format === 'test') {
      onStart('test', 0, 0, names, batsmanCount)

    } else if (format === 'batsman-overs') {
      const n = parseInt(batsmanOvers, 10)
      if (!n || n < 1 || n > 20) { setError('Enter overs per batsman between 1 and 20'); return }
      onStart('batsman-overs', 0, n, names, batsmanCount)
    }
  }

  const showConfig = !!format

  return (
    <div className="game">
      <div className="header">
        <div className="header-left">
          <button className="icon-btn" onClick={onBack}>←</button>
        </div>
        <h1>Book Cricket</h1>
        <div className="header-right" />
      </div>

      <div className="bc-setup">
        <p className="mode-subtitle">Choose match format</p>
        <div className="mode-cards">
          <button
            className={`mode-card ${format === 'limited' ? 'bc-card--selected' : ''}`}
            onClick={() => { setFormat('limited'); setError('') }}
          >
            <span className="mode-icon">⚡</span>
            <span className="mode-text">
              <span className="mode-name">Limited Overs</span>
              <span className="mode-desc">Fixed overs — quick game</span>
            </span>
          </button>
          <button
            className={`mode-card ${format === 'test' ? 'bc-card--selected' : ''}`}
            onClick={() => { setFormat('test'); setError('') }}
          >
            <span className="mode-icon">📚</span>
            <span className="mode-text">
              <span className="mode-name">Test Match</span>
              <span className="mode-desc">Bat until all out</span>
            </span>
          </button>
          <button
            className={`mode-card ${format === 'batsman-overs' ? 'bc-card--selected' : ''}`}
            onClick={() => { setFormat('batsman-overs'); setError('') }}
          >
            <span className="mode-icon">🎯</span>
            <span className="mode-text">
              <span className="mode-name">Batsman Overs</span>
              <span className="mode-desc">Each batsman gets fixed overs; 0 = −5 runs</span>
            </span>
          </button>
        </div>

        {format === 'limited' && (
          <div className="bc-overs-row">
            <label className="bc-overs-label">Number of overs</label>
            <input
              type="number" min="1" max="50"
              value={overs}
              onChange={e => { setOvers(e.target.value); setError('') }}
              placeholder="e.g. 5"
              className="bc-input"
            />
          </div>
        )}

        {format === 'batsman-overs' && (
          <div className="bc-overs-row">
            <label className="bc-overs-label">Overs per batsman</label>
            <input
              type="number" min="1" max="20"
              value={batsmanOvers}
              onChange={e => { setBatsmanOvers(e.target.value); setError('') }}
              placeholder="e.g. 3"
              className="bc-input"
            />
          </div>
        )}

        {showConfig && (
          <BatsmanCountPicker value={batsmanCount} onChange={n => { setBatsmanCount(n); setError('') }} />
        )}

        {showConfig && (
          <NamesSection names={names} count={batsmanCount} onChange={setNames} />
        )}

        {(error || joinError) && <p className="error">{error || joinError}</p>}

        {showConfig && (
          <button className="accept-btn" style={{ marginTop: '0.5rem' }} onClick={handleStart}>
            Start Match →
          </button>
        )}
      </div>
    </div>
  )
}
