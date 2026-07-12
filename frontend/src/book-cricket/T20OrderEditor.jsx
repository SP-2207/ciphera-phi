import { useState } from 'react'

function OrderList({ label, country, players, onChange }) {
  function move(idx, dir) {
    const next = [...players]
    const swap = idx + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    onChange(next)
  }

  return (
    <div className="t20-order-section">
      <div className="t20-order-header">
        <span className="t20-order-flag">{country.flag}</span>
        <span className="t20-order-country">{country.name}</span>
        <span className="t20-order-innings">{label}</span>
      </div>
      <table className="t20-sc-table">
        <thead>
          <tr className="t20-sc-thead">
            <th className="t20-sc-th t20-sc-th--num">#</th>
            <th className="t20-sc-th">Batsman</th>
            <th className="t20-sc-th t20-sc-th--ctrl" />
          </tr>
        </thead>
        <tbody>
          {players.map((p, i) => (
            <tr key={i} className="t20-sc-row t20-sc-row--edit">
              <td className="t20-sc-td t20-sc-td--num">{i + 1}</td>
              <td className="t20-sc-td">
                {p.name}
                {p.captain && <span className="t20-role-badge t20-role-badge--c">C</span>}
                {p.wk      && <span className="t20-role-badge t20-role-badge--wk">WK</span>}
              </td>
              <td className="t20-sc-td t20-sc-td--ctrl">
                <button className="t20-order-btn" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                <button className="t20-order-btn" onClick={() => move(i,  1)} disabled={i === players.length - 1}>↓</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function T20OrderEditor({ userCountry, compCountry, onStart, onBack }) {
  const [userPlayers, setUserPlayers] = useState([...userCountry.players])
  const [compPlayers, setCompPlayers] = useState([...compCountry.players])

  return (
    <div className="game t20-order-screen">
      <div className="header">
        <div className="header-left">
          <button className="icon-btn" onClick={onBack}>←</button>
        </div>
        <h1>Batting Order</h1>
        <div className="header-right" />
      </div>

      <div className="t20-order-wrap">
        <div className="t20-order-scroll">
          <p className="mode-subtitle" style={{ margin: 0 }}>Drag the order to your liking, then start the match</p>
          <OrderList
            label="YOUR INNINGS"
            country={userCountry}
            players={userPlayers}
            onChange={setUserPlayers}
          />
          <OrderList
            label="COMPUTER INNINGS"
            country={compCountry}
            players={compPlayers}
            onChange={setCompPlayers}
          />
        </div>
        <div className="t20-order-footer">
          <button
            className="accept-btn"
            onClick={() => onStart(userPlayers, compPlayers)}
          >
            🏏 Start Match →
          </button>
        </div>
      </div>
    </div>
  )
}
