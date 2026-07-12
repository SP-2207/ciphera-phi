import { useState, useEffect } from 'react'
import CipheraApp    from './CipheraApp'
import BookCricketApp from './BookCricketApp'
import DotsBoxesApp  from './DotsBoxesApp'
import './App.css'

const GAMES = [
  {
    id: 'ciphera',
    name: 'Ciphera',
    icon: '🔢',
    desc: 'Guess the secret 6-digit number in 6 tries',
    accent: '#5865f2',
    tag: 'Numbers',
  },
  {
    id: 'book-cricket',
    name: 'Book Cricket',
    icon: '📖',
    desc: 'The classic page-turning batting game',
    accent: '#538d4e',
    tag: 'Cricket',
  },
  {
    id: 'dots-boxes',
    name: 'Dots & Boxes',
    icon: '⬛',
    desc: 'Draw lines to claim boxes on a 10×10 grid',
    accent: '#e74c3c',
    tag: 'Strategy',
  },
]

export default function App() {
  const [currentGame, setCurrentGame] = useState(null)

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash === 'ciphera' || /^compete\/[A-Z][A-Z0-9]{5}$/.test(hash)) {
      setCurrentGame('ciphera')
    } else if (hash === 'book-cricket' || /^book-cricket\/[A-Z][A-Z0-9]{5}$/.test(hash)) {
      setCurrentGame('book-cricket')
    } else if (hash === 'dots-boxes' || /^dots-boxes\/[A-Z][A-Z0-9]{5}$/.test(hash)) {
      setCurrentGame('dots-boxes')
    }
  }, [])

  function openGame(id) {
    window.location.hash = id
    setCurrentGame(id)
  }

  function goHome() {
    window.location.hash = ''
    setCurrentGame(null)
  }

  if (currentGame === 'ciphera')      return <CipheraApp onHome={goHome} />
  if (currentGame === 'book-cricket') return <BookCricketApp onHome={goHome} />
  if (currentGame === 'dots-boxes')   return <DotsBoxesApp onHome={goHome} />

  return (
    <div className="hub">
      <div className="hub-header">
        <h1 className="hub-title">Game Vault</h1>
        <p className="hub-subtitle">Choose a game to play</p>
      </div>
      <div className="game-tiles">
        {GAMES.map(g => (
          <button
            key={g.id}
            className="game-tile"
            style={{ '--tile-accent': g.accent }}
            onClick={() => openGame(g.id)}
          >
            <span className="tile-icon">{g.icon}</span>
            <div className="tile-body">
              <span className="tile-name">{g.name}</span>
              <span className="tile-desc">{g.desc}</span>
            </div>
            <span className="tile-tag">{g.tag}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
