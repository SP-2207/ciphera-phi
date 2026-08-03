import { useState, useEffect, useRef } from 'react'
import PFSetup    from './pen-fight/PFSetup'
import PFLobby    from './pen-fight/PFLobby'
import PFToss     from './pen-fight/PFToss'
import PFGame     from './pen-fight/PFGame'
import PFResult   from './pen-fight/PFResult'
import PFInfoModal from './pen-fight/PFInfoModal'
import {
  newGameState, applyFlickResult, startNextRound, replayRound, randomComputerPen,
} from './pen-fight/pfLogic'
import {
  createPFRoom, getPFRoom, joinPFRoom, subscribeToPFRoom,
  startPFToss, startPFGame, pushPFGameState, deserializeGameState,
} from './pen-fight/pfFirebase'

function genRoomId() {
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const alnum = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let id = alpha[Math.floor(Math.random() * alpha.length)]
  for (let i = 0; i < 5; i++) id += alnum[Math.floor(Math.random() * alnum.length)]
  return id
}

function savePFSession(rid, data) {
  try { localStorage.setItem(`pf_session_${rid}`, JSON.stringify(data)) } catch (_) {}
}
function loadPFSession(rid) {
  try { return JSON.parse(localStorage.getItem(`pf_session_${rid}`)) } catch (_) { return null }
}
function clearPFSession(rid) {
  try { localStorage.removeItem(`pf_session_${rid}`) } catch (_) {}
}

// Screens: 'home' | 'setup' | 'lobby' | 'toss' | 'game' | 'result'
export default function PenFightApp({ onHome }) {
  const [screen,       setScreen]       = useState('home')
  const [showInfo,     setShowInfo]     = useState(false)
  const [mode,         setMode]         = useState(null)
  const [players,      setPlayers]      = useState([])
  const [mySlot,       setMySlot]       = useState(0)
  const [myPlayerId,   setMyPlayerId]   = useState(null)
  const [difficulty,   setDifficulty]   = useState('beginner')
  const [totalRounds,  setTotalRounds]  = useState(3)
  const [roomId,       setRoomId]       = useState(null)
  const [gameState,    setGameState]    = useState(null)
  const [tossData,     setTossData]     = useState(null)
  const [joinError,    setJoinError]    = useState('')
  const [isInvite,     setIsInvite]     = useState(false)
  const [inviteRoomId, setInviteRoomId] = useState(null)

  // Always-fresh refs for async callbacks
  const gameStateRef    = useRef(null)
  const playersRef      = useRef([])
  const modeRef         = useRef(null)
  const roomIdRef       = useRef(null)
  const myPlayerIdRef   = useRef(null)
  const screenRef       = useRef('home')
  const totalRoundsRef  = useRef(3)
  const startedRef      = useRef(false)
  const unsubRef        = useRef(null)

  gameStateRef.current   = gameState
  playersRef.current     = players
  modeRef.current        = mode
  roomIdRef.current      = roomId
  myPlayerIdRef.current  = myPlayerId
  screenRef.current      = screen
  totalRoundsRef.current = totalRounds

  // ── Mount: detect invite URL ──────────────────────────────────────────────
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    const m    = hash.match(/^pen-fight\/([A-Z][A-Z0-9]{5})$/)
    if (!m) return
    const rid   = m[1]
    const saved = loadPFSession(rid)
    setIsInvite(true)
    setInviteRoomId(rid)
    setMode('friend')
    modeRef.current = 'friend'
    if (saved?.playerId) {
      setMyPlayerId(saved.playerId)
      myPlayerIdRef.current = saved.playerId
      setRoomId(rid)
      roomIdRef.current = rid
      setScreen('lobby')
    } else {
      setScreen('setup')
    }
  }, []) // eslint-disable-line

  // ── Firebase subscription ─────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId || mode !== 'friend') return
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null }

    const unsub = subscribeToPFRoom(roomId, (room) => {
      if (!room) return

      // Update player list
      if (room.players) {
        const list = Object.entries(room.players)
          .map(([id, p]) => ({ id, initials: p.initials, slot: p.slot, isHost: !!p.isHost, isComputer: false }))
          .sort((a, b) => a.slot - b.slot)
        setPlayers(list)
        playersRef.current = list
        const me = list.find(p => p.id === myPlayerIdRef.current)
        if (me) setMySlot(me.slot)
      }

      if (room.rounds) {
        setTotalRounds(room.rounds)
        totalRoundsRef.current = room.rounds
      }

      // Host triggers toss when lobby is full
      if (room.phase === 'waiting' && !startedRef.current) {
        const entries = room.players ? Object.entries(room.players) : []
        if (entries.length >= (room.playerCount || 2)) {
          const me = room.players?.[myPlayerIdRef.current]
          if (me?.isHost) {
            startedRef.current = true
            setScreen('toss')
          }
        }
      }

      // Toss data
      if (room.toss) {
        setTossData(room.toss)
        if (screenRef.current === 'lobby' || screenRef.current === 'waiting') {
          setScreen('toss')
        }
      }

      // Game in progress
      if ((room.phase === 'playing' || room.phase === 'done') && room.gameState) {
        const gs = deserializeGameState(room.gameState)
        setGameState(gs)
        gameStateRef.current = gs
        if (room.phase === 'done') {
          setScreen('result')
        } else {
          setScreen(s => (s === 'result' ? s : 'game'))
        }
      }
    })

    unsubRef.current = unsub
    return () => { if (unsubRef.current) { unsubRef.current(); unsubRef.current = null } }
  }, [roomId, mode]) // eslint-disable-line

  // Safety net: game state arrived while on lobby/toss
  useEffect(() => {
    if (!gameState) return
    if (screenRef.current === 'lobby' || screenRef.current === 'toss') {
      setScreen(gameState.phase === 'done' ? 'result' : 'game')
    }
  }, [gameState]) // eslint-disable-line

  // ── Setup ─────────────────────────────────────────────────────────────────
  async function handleStart({ rounds, difficulty: diff, initials }) {
    setJoinError('')
    const r = rounds || 3
    setTotalRounds(r)
    totalRoundsRef.current = r
    setDifficulty(diff || 'beginner')

    if (mode === 'computer') {
      const ps = [
        { id: 'human', initials, slot: 0, isHost: true,  isComputer: false },
        { id: 'cpu',   initials: 'CPU', slot: 1, isHost: false, isComputer: true },
      ]
      setPlayers(ps)
      playersRef.current    = ps
      setMySlot(0)
      setMyPlayerId('human')
      myPlayerIdRef.current = 'human'
      setScreen('toss')
      return
    }

    // Friend: guest joining invite
    if (isInvite && inviteRoomId) {
      try {
        const room = await getPFRoom(inviteRoomId)
        if (!room) { setJoinError('Room not found. Ask your friend for a new link.'); return }
        const res  = await joinPFRoom(inviteRoomId, initials)
        if (!res)  { setJoinError('Room is full or already started.'); return }
        const { playerId, slot } = res
        setMyPlayerId(playerId)
        myPlayerIdRef.current = playerId
        setMySlot(slot)
        setRoomId(inviteRoomId)
        roomIdRef.current = inviteRoomId
        if (room.rounds) {
          setTotalRounds(room.rounds)
          totalRoundsRef.current = room.rounds
        }
        savePFSession(inviteRoomId, { playerId, initials })
        setScreen('lobby')
      } catch (err) {
        console.error(err)
        setJoinError('Could not join room. Check your connection.')
      }
      return
    }

    // Friend: host creates room
    try {
      const id     = genRoomId()
      const hostId = await createPFRoom(id, r, initials)
      setRoomId(id)
      roomIdRef.current     = id
      setMyPlayerId(hostId)
      myPlayerIdRef.current = hostId
      setMySlot(0)
      savePFSession(id, { playerId: hostId, initials })
      window.location.hash = `pen-fight/${id}`
      setScreen('lobby')
    } catch (err) {
      console.error(err)
      setJoinError('Could not create room. Check your connection.')
    }
  }

  // ── Toss ─────────────────────────────────────────────────────────────────
  async function handleCallToss(call, result, winnerId) {
    if (mode === 'friend') {
      try { await startPFToss(roomIdRef.current, call, result, winnerId) }
      catch (err) { console.error(err) }
    }
  }

  function handleTossComplete(winnerId) {
    const ps  = playersRef.current
    const p1Id = ps[0]?.id || 'human'
    const p2Id = ps[1]?.id || 'cpu'
    const gs   = newGameState(p1Id, p2Id, totalRoundsRef.current, winnerId)

    if (mode === 'computer') {
      setGameState(gs)
      gameStateRef.current = gs
      setScreen('game')
      return
    }

    // Friend: only host creates + pushes game state
    const me = ps.find(p => p.id === myPlayerIdRef.current)
    if (me?.isHost) {
      setGameState(gs)
      gameStateRef.current = gs
      startPFGame(roomIdRef.current, gs).catch(console.error)
    }
    // Guest and host both transition; Firebase will deliver for guest
    setScreen('game')
  }

  // ── Placement ─────────────────────────────────────────────────────────────
  function handlePlacePen(pen) {
    const gs    = gameStateRef.current
    const ps    = playersRef.current
    if (!gs) return

    const isP1  = mySlot === 0
    let newGs   = {
      ...gs,
      ...(isP1 ? { pen1: pen, p1Placed: true } : { pen2: pen, p2Placed: true }),
    }

    const p1Done = isP1 ? true : gs.p1Placed
    const p2Done = isP1 ? gs.p2Placed : true

    // vs Computer: auto-place CPU pen immediately
    if (mode === 'computer' && !newGs.pen2) {
      newGs.pen2    = randomComputerPen()
      newGs.p2Placed = true
    }

    // Start playing when both placed
    if (p1Done && (mode === 'computer' || p2Done)) {
      newGs.phase       = 'playing'
      newGs.currentTurn = newGs.firstTurn
    }

    setGameState(newGs)
    gameStateRef.current = newGs

    if (mode === 'friend') {
      // Check if host should start game
      const isPendingStart = newGs.phase === 'playing' || (p1Done && p2Done)
      if (isPendingStart) {
        pushPFGameState(roomIdRef.current, newGs).catch(console.error)
      } else {
        pushPFGameState(roomIdRef.current, newGs).catch(console.error)
      }
    }
  }

  // ── Flick ─────────────────────────────────────────────────────────────────
  function handleFlick(finalP1, finalP2, p1Fell, p2Fell, fromP1, fromP2, flickSlot, power, dir) {
    const gs  = gameStateRef.current
    const ps  = playersRef.current
    if (!gs)  return
    const p1Id = ps[0]?.id
    const p2Id = ps[1]?.id

    const newGs = {
      ...applyFlickResult(gs, p1Id, p2Id, finalP1, finalP2, p1Fell, p2Fell),
      // Store flick params so the remote viewer can replay the real physics
      lastFlick: { slot: flickSlot, power, dir, fromP1, fromP2 },
    }
    setGameState(newGs)
    gameStateRef.current = newGs

    if (mode === 'friend') {
      pushPFGameState(roomIdRef.current, newGs).catch(console.error)
    }

    // Game over: round overlay plays in PFGame for 2.8s then go to result
    if (newGs.phase === 'done') {
      setTimeout(() => setScreen('result'), 2800)
      return
    }

    // Round over but game continues
    if (newGs.lastResult?.roundOver) {
      setTimeout(() => {
        const cur = gameStateRef.current
        const next = (cur.lastResult?.p1Fell && cur.lastResult?.p2Fell)
          ? replayRound(cur, p1Id, p2Id)
          : startNextRound(cur, p1Id, p2Id)
        setGameState(next)
        gameStateRef.current = next
        if (mode === 'friend') {
          pushPFGameState(roomIdRef.current, next).catch(console.error)
        }
      }, 2800)
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────
  function handlePlayAgain() {
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null }
    if (roomIdRef.current) clearPFSession(roomIdRef.current)
    startedRef.current    = false
    gameStateRef.current  = null
    playersRef.current    = []

    setScreen('home')
    setMode(null)
    setPlayers([])
    setMySlot(0)
    setMyPlayerId(null)
    setRoomId(null)
    setGameState(null)
    setTossData(null)
    setJoinError('')
    setIsInvite(false)
    setInviteRoomId(null)
    window.location.hash = 'pen-fight'
  }

  function handleBack() {
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null }
    startedRef.current = false
    setMode(null)
    setIsInvite(false)
    setInviteRoomId(null)
    setJoinError('')
    window.location.hash = 'pen-fight'
    setScreen('home')
  }

  // ── Screens ───────────────────────────────────────────────────────────────

  if (screen === 'home') {
    return (
      <div className="game">
        {showInfo && <PFInfoModal onClose={() => setShowInfo(false)} />}
        <div className="header">
          <div className="header-left">
            <button className="icon-btn" onClick={onHome}>←</button>
          </div>
          <h1>Pen Fight</h1>
          <div className="header-right">
            <button className="icon-btn" onClick={() => setShowInfo(true)}>?</button>
          </div>
        </div>
        <p className="mode-subtitle">Choose how to play</p>
        <div className="mode-cards">
          <button
            className="mode-card"
            onClick={() => { setMode('computer'); modeRef.current = 'computer'; setScreen('setup') }}
          >
            <span className="mode-icon">🖥️</span>
            <span className="mode-text">
              <span className="mode-name">vs Computer</span>
              <span className="mode-desc">Flick your pen against the CPU — instant game</span>
            </span>
          </button>
          <button
            className="mode-card"
            onClick={() => { setMode('friend'); modeRef.current = 'friend'; setScreen('setup') }}
          >
            <span className="mode-icon">👥</span>
            <span className="mode-text">
              <span className="mode-name">vs Friend</span>
              <span className="mode-desc">Share a link and play online</span>
            </span>
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'setup') {
    return (
      <PFSetup
        mode={mode}
        isInvite={isInvite}
        joinError={joinError}
        onStart={handleStart}
        onBack={handleBack}
      />
    )
  }

  if (screen === 'lobby') {
    return (
      <PFLobby
        roomId={roomId}
        players={players}
        myPlayerId={myPlayerId}
        onBack={handleBack}
      />
    )
  }

  if (screen === 'toss') {
    return (
      <PFToss
        mode={mode}
        players={players}
        myPlayerId={myPlayerId}
        tossData={mode === 'friend' ? tossData : null}
        onCallToss={handleCallToss}
        onTossComplete={handleTossComplete}
      />
    )
  }

  if (screen === 'game') {
    if (!gameState) {
      // Waiting for Firebase to deliver initial game state (guest scenario)
      return (
        <div className="game">
          <div className="header">
            <div className="header-left" />
            <h1>Pen Fight</h1>
            <div className="header-right" />
          </div>
          <p className="pf-status" style={{ marginTop: '3rem' }}>Connecting…</p>
        </div>
      )
    }
    return (
      <PFGame
        players={players}
        mySlot={mySlot}
        myPlayerId={myPlayerId}
        mode={mode}
        difficulty={difficulty}
        gameState={gameState}
        onPlacePen={handlePlacePen}
        onFlick={handleFlick}
        onHome={onHome}
      />
    )
  }

  if (screen === 'result') {
    const gs = gameState
    return (
      <PFResult
        players={players}
        scores={gs?.scores || {}}
        onPlayAgain={handlePlayAgain}
        onHome={onHome}
      />
    )
  }

  return null
}
