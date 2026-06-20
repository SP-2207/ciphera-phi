export const DIGITS = 6
export const MAX_GUESSES = 6

export function generateSecret() {
  const digits = [String(Math.floor(Math.random() * 9) + 1)]
  for (let i = 1; i < DIGITS; i++) {
    digits.push(String(Math.floor(Math.random() * 10)))
  }
  return digits.join('')
}

export function getClues(secret, guess) {
  const result = Array(DIGITS).fill('absent')
  const secretUsed = Array(DIGITS).fill(false)
  const guessUsed = Array(DIGITS).fill(false)

  for (let i = 0; i < DIGITS; i++) {
    if (guess[i] === secret[i]) {
      result[i] = 'correct'
      secretUsed[i] = true
      guessUsed[i] = true
    }
  }

  for (let i = 0; i < DIGITS; i++) {
    if (guessUsed[i]) continue
    for (let j = 0; j < DIGITS; j++) {
      if (secretUsed[j]) continue
      if (guess[i] === secret[j]) {
        result[i] = 'present'
        secretUsed[j] = true
        break
      }
    }
  }

  return result
}

export function buildShareText(guesses, won, secret, mode) {
  const score = won ? guesses.length : 'X'
  const label = mode.charAt(0).toUpperCase() + mode.slice(1)
  const header = `Number Wordle ${score}/${MAX_GUESSES} [${label}]`
  const rows = guesses
    .map(({ clues }) =>
      clues.map(c => (c === 'correct' ? '🟩' : c === 'present' ? '🟨' : '⬛')).join('')
    )
    .join('\n')
  return won ? `${header}\n${rows}` : `${header}\n${rows}\nAnswer: ${secret}`
}
