const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['⌫', '0', '✓'],
]

export default function Keypad({ onKey }) {
  return (
    <div className="keypad">
      {ROWS.map((row, ri) => (
        <div key={ri} className="keypad-row">
          {row.map(k => (
            <button
              key={k}
              className={`key${k === '✓' ? ' key-enter' : ''}${k === '⌫' ? ' key-back' : ''}`}
              onClick={() => onKey(k)}
            >
              {k}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
