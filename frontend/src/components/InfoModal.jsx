import { DIGITS, MAX_GUESSES } from '../utils/gameLogic'

export default function InfoModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>How to Play</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p>
            Guess the secret <strong>{DIGITS}-digit number</strong> in {MAX_GUESSES} tries.
            After each guess, each digit is coloured:
          </p>

          <div className="modal-examples">
            <div className="modal-example">
              <div className="example-cells">
                <div className="cell correct">5</div>
                <div className="cell absent">3</div>
              </div>
              <p><strong style={{ color: '#538d4e' }}>Green</strong> — right digit, right position</p>
            </div>
            <div className="modal-example">
              <div className="example-cells">
                <div className="cell present">8</div>
                <div className="cell absent">2</div>
              </div>
              <p><strong style={{ color: '#b59f3b' }}>Yellow</strong> — right digit, wrong position</p>
            </div>
            <div className="modal-example">
              <div className="example-cells">
                <div className="cell absent">7</div>
                <div className="cell absent">4</div>
              </div>
              <p><strong style={{ color: '#818384' }}>Gray</strong> — digit not in the number</p>
            </div>
          </div>

          <ul className="modal-rules">
            <li>The first digit is never 0</li>
            <li>Digits can repeat in the secret number</li>
            <li>Tap the keypad or type to enter your guess</li>
          </ul>

          <div className="modal-modes">
            <h3>Game Modes</h3>
            <div className="mode-info-row">
              <span className="mode-badge classic">Classic</span>
              <span>Standard play — 6 guesses, no time pressure</span>
            </div>
            <div className="mode-info-row">
              <span className="mode-badge timed">Timed</span>
              <span>15 s per guess. Time up? Previous guess is auto-submitted!</span>
            </div>
            <div className="mode-info-row">
              <span className="mode-badge compete">Compete</span>
              <span>Share a link so a friend plays the exact same puzzle</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
