import { useState, useEffect } from 'react'
import BCHome   from './book-cricket/BCHome'
import BCSetup  from './book-cricket/BCSetup'
import BCLobby  from './book-cricket/BCLobby'
import BCGame   from './book-cricket/BCGame'
import BCResult from './book-cricket/BCResult'
import { createBCRoom, joinBCRoom, getBCRoom } from './book-cricket/bcFirebase'

function genRoomId() {
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const alnum = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let id = alpha[Math.floor(Math.random() * alpha.length)]
  for (let i = 0; i < 5; i++) id += alnum[Math.floor(Math.random() * alnum.length)]
  return id
}

// Screens: 'home' | 'setup' | 'joining' | 'lobby' | 'game' | 'result'
export default function BookCricketApp({ onHome }) {
  const [screen,    setScreen]    = useState('home')
  const [opponent,  setOpponent]  = useState(null)   // 'computer' | 'friend'
  const [format,    setFormat]    = useState(null)   // 'limited' | 'test'
  const [overs,     setOvers]     = useState(0)
  const [roomId,    setRoomId]    = useState(null)
  const [playerId,  setPlayerId]  = useState(null)
  const [isHost,    setIsHost]    = useState(false)
  const [myNames,   setMyNames]   = useState([])
  const [result,    setResult]    = useState(null)
  const [joinError, setJoinError] = useState('')

  // Filled when the URL already contains a room ID (#book-cricket/ROOMID)
  const [inviteRoomId, setInviteRoomId] = useState(null)

  // Detect invite URL on mount
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    const m    = hash.match(/^book-cricket\/([A-Z][A-Z0-9]{5})$/)
    if (m) {
      setInviteRoomId(m[1])
      setOpponent('friend')
      setIsHost(false)
      setRoomId(m[1])
      setScreen('setup')      // guest lands on invite-accept screen
    }
  }, [])

  // ── BCHome ───────────────────────────────────────────
  function handleSelectOpponent(opp) {
    setOpponent(opp)
    setScreen('setup')
  }

  // ── BCSetup ──────────────────────────────────────────
  async function handleStart(fmt, ovs, names = []) {
    setMyNames(names)

    // vs Computer — go straight to game
    if (opponent === 'computer') {
      setFormat(fmt)
      setOvers(ovs)
      setPlayerId('local')
      setIsHost(true)
      setScreen('game')
      return
    }

    setJoinError('')

    if (inviteRoomId) {
      // ── GUEST: join existing room ──────────────────
      setScreen('joining')
      try {
        const room = await getBCRoom(inviteRoomId)
        if (!room) {
          setJoinError('Room not found. Ask your friend to create a new invite.')
          setScreen('setup')
          return
        }
        const guestId = await joinBCRoom(inviteRoomId)
        if (!guestId) {
          setJoinError('Room is full or already started.')
          setScreen('setup')
          return
        }
        setFormat(room.format)
        setOvers(room.overs || 0)
        setPlayerId(guestId)
        setIsHost(false)
        // Keep hash unchanged — we're already at #book-cricket/ROOMID
        setScreen('game')
      } catch (err) {
        console.error(err)
        setJoinError('Could not join room. Check your connection and try again.')
        setScreen('setup')
      }
    } else {
      // ── HOST: create room, show lobby with share link ──
      setScreen('joining')
      try {
        const id = genRoomId()
        await createBCRoom(id, fmt, ovs)
        setRoomId(id)
        setFormat(fmt)
        setOvers(ovs)
        setPlayerId('host')
        setIsHost(true)
        window.location.hash = `book-cricket/${id}`
        setScreen('lobby')   // ← show lobby with share link, wait for guest
      } catch (err) {
        console.error(err)
        setJoinError('Could not create room. Check your connection and try again.')
        setScreen('setup')
      }
    }
  }

  // ── BCLobby: opponent joined → start ────────────────
  function handleOpponentJoined() {
    setScreen('game')
  }

  // ── BCGame callback ──────────────────────────────────
  function handleGameOver(myTeam, oppTeam) {
    setResult({ myTeam, oppTeam })
    setScreen('result')
    window.location.hash = 'book-cricket'
  }

  // ── BCResult: play again ─────────────────────────────
  function handlePlayAgain() {
    setResult(null)
    setRoomId(null)
    setPlayerId(null)
    setInviteRoomId(null)
    setFormat(null)
    setOvers(0)
    setMyNames([])
    setJoinError('')
    window.location.hash = 'book-cricket'
    setScreen('home')
  }

  // ── Back to home (from setup or lobby) ───────────────
  function handleBack() {
    window.location.hash = 'book-cricket'
    setInviteRoomId(null)
    setOpponent(null)
    setJoinError('')
    setScreen('home')
  }

  // ── Render ───────────────────────────────────────────
  if (screen === 'home') {
    return <BCHome onSelect={handleSelectOpponent} onHome={onHome} />
  }

  if (screen === 'setup') {
    return (
      <BCSetup
        isInvite={!!inviteRoomId}
        joinError={joinError}
        onStart={handleStart}
        onBack={handleBack}
      />
    )
  }

  if (screen === 'joining') {
    return (
      <div className="game">
        <div className="header">
          <div className="header-left" />
          <h1>Book Cricket</h1>
          <div className="header-right" />
        </div>
        <p className="loading-msg">Setting up room…</p>
      </div>
    )
  }

  if (screen === 'lobby') {
    return (
      <BCLobby
        roomId={roomId}
        format={format}
        overs={overs}
        onOpponentJoined={handleOpponentJoined}
        onHome={onHome}
      />
    )
  }

  if (screen === 'game') {
    return (
      <BCGame
        format={format}
        overs={overs}
        opponent={opponent}
        roomId={roomId}
        playerId={playerId}
        isHost={isHost}
        myBatsmenNames={myNames}
        onGameOver={handleGameOver}
        onHome={onHome}
      />
    )
  }

  if (screen === 'result' && result) {
    return (
      <BCResult
        myTeam={result.myTeam}
        oppTeam={result.oppTeam}
        opponent={opponent}
        format={format}
        overs={overs}
        onPlayAgain={handlePlayAgain}
        onHome={onHome}
      />
    )
  }

  return null
}
