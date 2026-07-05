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
  const [screen,       setScreen]       = useState('home')
  const [opponent,     setOpponent]     = useState(null)
  const [format,       setFormat]       = useState(null)
  const [overs,        setOvers]        = useState(0)
  const [batsmanOvers, setBatsmanOvers] = useState(0)
  const [batsmanCount, setBatsmanCount] = useState(4)
  const [roomId,       setRoomId]       = useState(null)
  const [playerId,     setPlayerId]     = useState(null)
  const [isHost,       setIsHost]       = useState(false)
  const [myNames,      setMyNames]      = useState([])
  const [result,       setResult]       = useState(null)
  const [joinError,    setJoinError]    = useState('')
  const [inviteRoomId, setInviteRoomId] = useState(null)
  const [guestBatCount, setGuestBatCount] = useState(4)  // pre-fetched for guest invite

  // Detect invite URL on mount: #book-cricket/ROOMID
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    const m    = hash.match(/^book-cricket\/([A-Z][A-Z0-9]{5})$/)
    if (m) {
      const rid = m[1]
      setInviteRoomId(rid)
      setOpponent('friend')
      setIsHost(false)
      setRoomId(rid)
      // Pre-fetch room to show correct batsman count in name inputs
      getBCRoom(rid).then(room => {
        if (room?.batsmanCount) setGuestBatCount(room.batsmanCount)
      }).catch(() => {})
      setScreen('setup')
    }
  }, [])

  // ── BCHome ───────────────────────────────────────────
  function handleSelectOpponent(opp) {
    setOpponent(opp)
    setScreen('setup')
  }

  // ── BCSetup → handleStart(format, overs, batsmanOvers, names, batsmanCount) ──
  async function handleStart(fmt, ovs, batOvs, names = [], count = 4) {
    setMyNames(names)
    setBatsmanCount(count)
    setJoinError('')

    if (opponent === 'computer') {
      setFormat(fmt)
      setOvers(ovs)
      setBatsmanOvers(batOvs)
      setPlayerId('local')
      setIsHost(true)
      setScreen('game')
      return
    }

    if (inviteRoomId) {
      // ── GUEST ──────────────────────────────────────
      setScreen('joining')
      try {
        const room = await getBCRoom(inviteRoomId)
        if (!room) { setJoinError('Room not found. Ask your friend to create a new invite.'); setScreen('setup'); return }
        const guestId = await joinBCRoom(inviteRoomId)
        if (!guestId) { setJoinError('Room is full or already started.'); setScreen('setup'); return }
        setFormat(room.format)
        setOvers(room.overs        || 0)
        setBatsmanOvers(room.batsmanOvers || 0)
        setBatsmanCount(room.batsmanCount || count)
        setPlayerId(guestId)
        setIsHost(false)
        setScreen('game')
      } catch (err) {
        console.error(err)
        setJoinError('Could not join room. Check your connection and try again.')
        setScreen('setup')
      }
    } else {
      // ── HOST ───────────────────────────────────────
      setScreen('joining')
      try {
        const id = genRoomId()
        await createBCRoom(id, fmt, ovs, batOvs, count)
        setRoomId(id)
        setFormat(fmt)
        setOvers(ovs)
        setBatsmanOvers(batOvs)
        setPlayerId('host')
        setIsHost(true)
        window.location.hash = `book-cricket/${id}`
        setScreen('lobby')
      } catch (err) {
        console.error(err)
        setJoinError('Could not create room. Check your connection and try again.')
        setScreen('setup')
      }
    }
  }

  function handleOpponentJoined() { setScreen('game') }

  function handleGameOver(myTeam, oppTeam) {
    setResult({ myTeam, oppTeam })
    setScreen('result')
    window.location.hash = 'book-cricket'
  }

  function handlePlayAgain() {
    setResult(null); setRoomId(null); setPlayerId(null)
    setInviteRoomId(null); setFormat(null); setOvers(0)
    setBatsmanOvers(0); setBatsmanCount(4); setMyNames([]); setJoinError('')
    window.location.hash = 'book-cricket'
    setScreen('home')
  }

  function handleBack() {
    window.location.hash = 'book-cricket'
    setInviteRoomId(null); setOpponent(null); setJoinError('')
    setScreen('home')
  }

  // ── Render ───────────────────────────────────────────
  if (screen === 'home') return <BCHome onSelect={handleSelectOpponent} onHome={onHome} />

  if (screen === 'setup') {
    return (
      <BCSetup
        isInvite={!!inviteRoomId}
        joinError={joinError}
        guestBatsmanCount={guestBatCount}
        onStart={handleStart}
        onBack={handleBack}
      />
    )
  }

  if (screen === 'joining') {
    return (
      <div className="game">
        <div className="header"><div className="header-left" /><h1>Book Cricket</h1><div className="header-right" /></div>
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
        batsmanOvers={batsmanOvers}
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
        batsmanOvers={batsmanOvers}
        batsmanCount={batsmanCount}
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
        batsmanOvers={batsmanOvers}
        onPlayAgain={handlePlayAgain}
        onHome={onHome}
      />
    )
  }

  return null
}
