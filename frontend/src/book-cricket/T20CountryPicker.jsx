import { useState } from 'react'
import { T20_TEAMS } from './t20Teams'

function TeamFlag({ team }) {
  if (team.abbr) {
    return (
      <span
        className="t20-cc-flag t20-cc-abbr"
        style={{ background: team.accent }}
      >
        {team.abbr}
      </span>
    )
  }
  return <span className="t20-cc-flag">{team.flag}</span>
}

export default function T20CountryPicker({ onSelect, onBack }) {
  const [userTeam, setUserTeam] = useState(null)
  const [compTeam, setCompTeam] = useState(null)

  function handleContinue() {
    if (!userTeam || !compTeam) return
    onSelect(userTeam, compTeam)
  }

  return (
    <div className="game">
      <div className="header">
        <div className="header-left">
          <button className="icon-btn" onClick={onBack}>←</button>
        </div>
        <h1>T20 World Cup</h1>
        <div className="header-right" />
      </div>

      <div className="t20-picker">
        {/* Step 1 */}
        <p className="t20-pick-label">🏏 Pick YOUR team</p>
        <div className="t20-country-grid">
          {T20_TEAMS.map(team => (
            <button
              key={team.id}
              className={`t20-country-card${userTeam?.id === team.id ? ' t20-country-card--selected' : ''}${compTeam?.id === team.id ? ' t20-country-card--taken' : ''}`}
              onClick={() => {
                if (compTeam?.id === team.id) return
                setUserTeam(team)
              }}
              disabled={compTeam?.id === team.id}
            >
              <TeamFlag team={team} />
              <span className="t20-cc-name">{team.name}</span>
            </button>
          ))}
        </div>

        {/* Step 2 */}
        <p className="t20-pick-label" style={{ marginTop: '1.2rem' }}>🤖 Pick OPPONENT</p>
        <div className="t20-country-grid">
          {T20_TEAMS.map(team => (
            <button
              key={team.id}
              className={`t20-country-card${compTeam?.id === team.id ? ' t20-country-card--selected' : ''}${userTeam?.id === team.id ? ' t20-country-card--taken' : ''}`}
              onClick={() => {
                if (userTeam?.id === team.id) return
                setCompTeam(team)
              }}
              disabled={userTeam?.id === team.id}
            >
              <TeamFlag team={team} />
              <span className="t20-cc-name">{team.name}</span>
            </button>
          ))}
        </div>

        <button
          className="accept-btn"
          style={{ marginTop: '1.5rem' }}
          disabled={!userTeam || !compTeam}
          onClick={handleContinue}
        >
          Set Batting Order →
        </button>
      </div>
    </div>
  )
}
