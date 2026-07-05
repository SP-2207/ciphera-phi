import { useState, useEffect, useCallback } from 'react'
import BCHome   from './book-cricket/BCHome'
import BCSetup  from './book-cricket/BCSetup'
import BCLobby  from './book-cricket/BCLobby'
import BCGame   from './book-cricket/BCGame'
import BCResult from './book-cricket/BCResult'
import { createBCRoom, joinBCRoom, getBCRoom } from './book-cricket/bcFirebase'

const SESSION_KEY = 'bc_active_session'

function saveSession(data) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(data)) } catch (_) {}
}
function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) } catch (_) { return null }
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY) } catch (_) {}
}

function genRoomId() {
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const alnum = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let id = alpha[Math.floor(Math.random() * alpha.length)]
  for (let i = 0; i < 5; i++) id += alnum[Math.floor(Math.random() * alnum.length)]
  return id
}

// Screens: 'home' | 'setup' | 'joining' | 'lobby' | 'game' | 'result'
export default function BookCricketApp({ onHome }) {
  const [screen,        setScreen]        = useState('home')
  const [opponent,      setOpponent]      = useState(null)
  const [format,        setFormat]        = useState(null)
  const [overs,         setOvers]         = useState(0)
  const [batsmanOvers,  setBatsmanOvers]  = useState(0)
  const [batsmanCount,  setBatsmanCount]  = useState(4)
  const [roomId,        setRoomId]        = useState(null)
  const [playerId,      setPlayerId]      = useState(null)
  const [isHost,        setIsHost]        = useState(false)
  const [myNames,       setMyNames]       = useState([])
  const [result,        setResult]        = useState(null)
  const [joinError,     setJoinError]     = useState('')
  const [inviteRoomId,  setInviteRoomId]  = useState(null)
  const [guestBatCount, setGuestBatCount] = useState(4)

  // Restored team state for computer-mode sessions
  const [savedMyTeam,  setSavedMyTeam]  = useState(null)
  const [savedOppTeam, setSavedOppTeam] = useState(null)

  // On mount: restore saved session OR detect invite URL
  useEffect(() => {
    const saved = loadSession()
    if (saved?.opponent === 'friend' && saved?.roomId && saved?.playerId) {
      setOpponent('friend')
      setFormat(saved.format)
      setOvers(saved.overs        || 0)
      setBatsmanOvers(saved.batsmanOvers || 0)
      setBatsmanCount(saved.batsmanCount || 4)
      setRoomId(saved.roomId)
      setPlayerId(saved.playerId)
      setIsHost(saved.isHost)
      setMyNames(saved.myNames || [])
      window.location.hash = `book-cricket/${saved.roomId}`
      setScreen('game')
      return
    }

    if (saved?.opponent === 'computer' && saved?.format) {
      setOpponent('computer')
      setFormat(saved.format)
      setOvers(saved.overs        || 0)
      setBatsmanOvers(saved.batsmanOvers || 0)
      setBatsmanCount(saved.batsmanCount || 4)
      setMyNames(saved.myNames || [])
      setPlayerId('local')
      setIsHost(true)
      if (saved.myTeam)  setSavedMyTeam(saved.myTeam)
      if (saved.oppTeam) setSavedOppTeam(saved.oppTeam)
      setScreen('game')
      return
    }

    // No saved session — check for invite URL
    const hash = window.location.hash.slice(1)
    const m    = hash.match(/^book-cricket\/([A-Z][A-Z0-9]{5})$/)
    if (m) {
      const rid = m[1]
      setInviteRoomId(rid)
      setOpponent('friend')
      setIsHost(false)
      setRoomId(rid)
      getBCRoom(rid).then(room => {
        if (room?.batsmanCount) setGuestBatCount(room.batsmanCount)
      }).catch(() => {})
      setScreen('setup')
    }
  }, []) // eslint-disable-line

  // BCGame calls this on every team update — used to persist computer sessions
  const handleTeamUpdate = useCallback((myTeam, oppTeam) => {
    if (opponent !== 'computer') return
    saveSession({
      opponent: 'computer', format, overs, batsmanOvers, batsmanCount,
      myNames, myTeam, oppTeam,
    })
  }, [opponent, format, overs, batsmanOvers, batsmanCount, myNames])

  function handleSelectOpponent(opp) {
    setOpponent(opp)
    setScreen('setup')
  }

  async function handleStart(fmt, ovs, batOvs, names = [], count = 4) {
    setMyNames(names)
    setBatsmanCount(count)
    setJoinError('')
    setSavedMyTeam(null)
    setSavedOppTeam(null)

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
      setScreen('joining')
      try {
        const room = await getBCRoom(inviteRoomId)
        if (!room) { setJoinError('Room not found. Ask your friend to create a new invite.'); setScreen('setup'); return }
        const guestId = await joinBCRoom(inviteRoomId)
        if (!guestId) { setJoinError('Room is full or already started.'); setScreen('setup'); return }
        const resolvedFmt    = room.format
        const resolvedOvs    = room.overs        || 0
        const resolvedBatOvs = room.batsmanOvers || 0
        const resolvedCount  = room.batsmanCount || count
        setFormat(resolvedFmt)
        setOvers(resolvedOvs)
        setBatsmanOvers(resolvedBatOvs)
        setBatsmanCount(resolvedCount)
        setPlayerId(guestId)
        setIsHost(false)
        saveSession({
          opponent: 'friend', roomId: inviteRoomId, playerId: guestId,
          isHost: false, format: resolvedFmt, overs: resolvedOvs,
          batsmanOvers: resolvedBatOvs, batsmanCount: resolvedCount, myNames: names,
        })
        setScreen('game')
      } catch (err) {
        console.error(err)
        setJoinError('Could not join room. Check your connection and try again.')
        setScreen('setup')
      }
    } else {
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

  function handleOpponentJoined() {
    saveSession({
      opponent: 'friend', roomId, playerId: 'host',
      isHost: true, format, overs, batsmanOvers, batsmanCount, myNames,
    })
    setScreen('game')
  }

  function handleGameOver(myTeam, oppTeam) {
    clearSession()
    setResult({ myTeam, oppTeam })
    setScreen('result')
    window.location.hash = 'book-cricket'
  }

  function handlePlayAgain() {
    clearSession()
    setResult(null); setRoomId(null); setPlayerId(null)
    setInviteRoomId(null); setFormat(null); setOvers(0)
    setBatsmanOvers(0); setBatsmanCount(4); setMyNames([])
    setSavedMyTeam(null); setSavedOppTeam(null); setJoinError('')
    window.location.hash = 'book-cricket'
    setScreen('home')
  }

  function handleBack() {
    clearSession()
    window.location.hash = 'book-cricket'
    setInviteRoomId(null); setOpponent(null); setJoinError('')
    setSavedMyTeam(null); setSavedOppTeam(null)
    setScreen('home')
  }

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
        initialMyTeam={savedMyTeam}
        initialOppTeam={savedOppTeam}
        onGameOver={handleGameOver}
        onTeamUpdate={opponent === 'computer' ? handleTeamUpdate : undefined}
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
