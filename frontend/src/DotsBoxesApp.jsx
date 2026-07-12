import { useState, useEffect, useRef } from 'react'
import DBSetup     from './dots-boxes/DBSetup'
import DBLobby     from './dots-boxes/DBLobby'
import DBGame      from './dots-boxes/DBGame'
import DBResult    from './dots-boxes/DBResult'
import DBInfoModal from './dots-boxes/DBInfoModal'
import {
  newGameState,
  applyMove,
  computeMove,
} from './dots-boxes/dbLogic'
import {
  createDBRoom,
  getDBRoom,
  joinDBRoom,
  subscribeToDBRoom,
  startDBGame,
  pushDBGameState,
  deserializeGameState,
} from './dots-boxes/dbFirebase'

function genRoomId() {
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const alnum = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let id = alpha[Math.floor(Math.random() * alpha.length)]
  for (let i = 0; i < 5; i++) id += alnum[Math.floor(Math.random() * alnum.length)]
  return id
}

// Screens: 'home' | 'setup' | 'lobby' | 'game' | 'result'
export default function DotsBoxesApp({ onHome }) {
  const [screen,           setScreen]           = useState('home')
  const [mode,             setMode]             = useState(null)        // 'computer' | 'friend'
  const [players,          setPlayers]          = useState([])
  const [mySlot,           setMySlot]           = useState(0)
  const [myPlayerId,       setMyPlayerId]        = useState(null)
  const [difficulty,       setDifficulty]       = useState('beginner')
  const [roomId,           setRoomId]           = useState(null)
  const [gameState,        setGameState]        = useState(null)
  const [finalState,       setFinalState]       = useState(null)
  const [joinError,        setJoinError]        = useState('')
  const [showInfo,         setShowInfo]         = useState(false)
  const [isInvite,         setIsInvite]         = useState(false)
  const [inviteRoomId,     setInviteRoomId]     = useState(null)
  const [targetPlayerCount, setTargetPlayerCount] = useState(2)

  // Refs for always-fresh values inside async callbacks / subscriptions
  const gameStateRef   = useRef(null)
  const playersRef     = useRef([])
  const modeRef        = useRef(null)
  const roomIdRef      = useRef(null)
  const difficultyRef  = useRef('beginner')
  const myPlayerIdRef  = useRef(null)
  const screenRef      = useRef('home')
  const startedRef     = useRef(false)
  const unsubRef       = useRef(null)

  // Keep refs in sync
  gameStateRef.current  = gameState
  playersRef.current    = players
  modeRef.current       = mode
  roomIdRef.current     = roomId
  difficultyRef.current = difficulty
  myPlayerIdRef.current = myPlayerId
  screenRef.current     = screen

  // ── Mount: detect invite URL ──────────────────────────────────────────────
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    const m    = hash.match(/^dots-boxes\/([A-Z][A-Z0-9]{5})$/)
    if (m) {
      setIsInvite(true)
      setInviteRoomId(m[1])
      setMode('friend')
      modeRef.current = 'friend'
      setScreen('setup')
    }
  }, []) // eslint-disable-line

  // ── Firebase subscription (friend mode) ───────────────────────────────────
  useEffect(() => {
    if (!roomId || mode !== 'friend') return

    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null }

    const unsub = subscribeToDBRoom(roomId, (room) => {
      if (!room) return

      // Always update player list
      if (room.players) {
        const list = Object.entries(room.players)
          .map(([id, p]) => ({
            id,
            initials:   p.initials,
            slot:       p.slot,
            isHost:     !!p.isHost,
            isComputer: false,
          }))
          .sort((a, b) => a.slot - b.slot)
        setPlayers(list)
        playersRef.current = list

        // Keep mySlot up to date
        const currId  = myPlayerIdRef.current
        const myEntry = list.find(p => p.id === currId)
        if (myEntry) setMySlot(myEntry.slot)
      }

      // Host: start game when lobby is full
      if (room.phase === 'waiting' && !startedRef.current) {
        const allEntries  = room.players ? Object.entries(room.players) : []
        const count       = room.playerCount || 2
        if (allEntries.length >= count) {
          const currId = myPlayerIdRef.current
          if (room.players[currId]?.isHost) {
            startedRef.current = true
            const sorted = allEntries
              .map(([id, p]) => ({ id, initials: p.initials, slot: p.slot, isHost: !!p.isHost, isComputer: false }))
              .sort((a, b) => a.slot - b.slot)
            const playerIds    = sorted.map(p => p.id)
            const initialState = newGameState(playerIds)
            setPlayers(sorted)
            playersRef.current = sorted
            startDBGame(roomId, initialState).catch(console.error)
          }
        }
      }

      // Game over
      if (room.phase === 'done' && room.gameState) {
        const gs = deserializeGameState(room.gameState)
        setFinalState(gs)
        setGameState(gs)
        gameStateRef.current = gs
        setScreen('result')
        return
      }

      // Game in progress
      if (room.phase === 'playing' && room.gameState) {
        const gs = deserializeGameState(room.gameState)
        setGameState(gs)
        gameStateRef.current = gs
        setScreen(s => (s === 'result' ? s : 'game'))
      }
    })

    unsubRef.current = unsub
    return () => { if (unsubRef.current) { unsubRef.current(); unsubRef.current = null } }
  }, [roomId, mode]) // eslint-disable-line

  // ── Computer AI trigger ───────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'computer' || !gameState) return
    const gs      = gameStateRef.current
    const ps      = playersRef.current
    const curP    = ps[gs?.currentSlot]
    if (!curP?.isComputer || gs?.phase !== 'playing') return

    const timer = setTimeout(() => {
      const latest = gameStateRef.current
      const move   = computeMove(latest, difficultyRef.current)
      if (move) handleMove(move.type, move.idx)
    }, 700)

    return () => clearTimeout(timer)
  }, [gameState?.currentSlot, gameState?.moveCount]) // eslint-disable-line

  // ── Move handler (always reads from refs for freshness) ───────────────────
  function handleMove(type, idx) {
    const gs  = gameStateRef.current
    const ps  = playersRef.current
    const m   = modeRef.current
    const rid = roomIdRef.current

    if (!gs || gs.phase !== 'playing') return

    // Skip action: advance turn
    if (type === 'skip') {
      const nextSlot = (gs.currentSlot + 1) % ps.length
      const newGs    = { ...gs, currentSlot: nextSlot, turnStartedAt: Date.now() }
      setGameState(newGs)
      gameStateRef.current = newGs
      if (m === 'friend' && rid) pushDBGameState(rid, newGs).catch(console.error)
      return
    }

    const playerId = ps[gs.currentSlot]?.id
    if (!playerId) return

    const result = applyMove(gs, type, idx, playerId)
    if (!result) return

    const { state: newState, bonusTurn } = result
    const nextSlot = bonusTurn
      ? gs.currentSlot
      : (gs.currentSlot + 1) % ps.length

    const finalGs = { ...newState, currentSlot: nextSlot, turnStartedAt: Date.now() }
    setGameState(finalGs)
    gameStateRef.current = finalGs

    if (m === 'friend' && rid) {
      pushDBGameState(rid, finalGs).catch(console.error)
    }

    if (finalGs.phase === 'done') {
      setFinalState(finalGs)
      if (m === 'computer') setScreen('result')
    }
  }

  // ── Setup: start game or create/join room ─────────────────────────────────
  async function handleStart({ playerCount, difficulty: diff, initials }) {
    setJoinError('')
    setDifficulty(diff || 'beginner')
    difficultyRef.current = diff || 'beginner'

    if (mode === 'computer') {
      const botCount    = playerCount - 1
      const botInitials = botCount === 1
        ? ['CPU']
        : Array.from({ length: botCount }, (_, i) => `C${i + 1}`)

      const newPlayers = [
        { id: 'human', initials, slot: 0, isComputer: false, isHost: true },
        ...botInitials.map((ini, i) => ({
          id: `cpu${i}`, initials: ini, slot: i + 1, isComputer: true, isHost: false,
        })),
      ]
      const playerIds    = newPlayers.map(p => p.id)
      const gs           = newGameState(playerIds)

      setPlayers(newPlayers)
      playersRef.current    = newPlayers
      setMySlot(0)
      setMyPlayerId('human')
      myPlayerIdRef.current = 'human'
      setGameState(gs)
      gameStateRef.current  = gs
      setScreen('game')
      return
    }

    // Friend mode: guest joining via invite
    if (isInvite && inviteRoomId) {
      try {
        const room = await getDBRoom(inviteRoomId)
        if (!room) { setJoinError('Room not found. Ask your friend to create a new invite.'); return }
        const res  = await joinDBRoom(inviteRoomId, initials)
        if (!res)  { setJoinError('Room is full or already started.'); return }
        const { playerId, slot } = res
        setMyPlayerId(playerId)
        myPlayerIdRef.current = playerId
        setMySlot(slot)
        setRoomId(inviteRoomId)
        roomIdRef.current = inviteRoomId
        setTargetPlayerCount(room.playerCount || 2)
        setScreen('lobby')
      } catch (err) {
        console.error(err)
        setJoinError('Could not join room. Check your connection.')
      }
      return
    }

    // Friend mode: host creating room
    try {
      const id     = genRoomId()
      const hostId = await createDBRoom(id, playerCount, initials)
      setRoomId(id)
      roomIdRef.current     = id
      setMyPlayerId(hostId)
      myPlayerIdRef.current = hostId
      setMySlot(0)
      setTargetPlayerCount(playerCount)
      window.location.hash = `dots-boxes/${id}`
      setScreen('lobby')
    } catch (err) {
      console.error(err)
      setJoinError('Could not create room. Check your connection.')
    }
  }

  // ── Play Again / Back ─────────────────────────────────────────────────────
  function handlePlayAgain() {
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null }
    startedRef.current    = false
    gameStateRef.current  = null
    playersRef.current    = []
    modeRef.current       = null
    roomIdRef.current     = null
    myPlayerIdRef.current = null

    setScreen('home')
    setMode(null)
    setPlayers([])
    setMySlot(0)
    setMyPlayerId(null)
    setDifficulty('beginner')
    setRoomId(null)
    setGameState(null)
    setFinalState(null)
    setJoinError('')
    setIsInvite(false)
    setInviteRoomId(null)
    window.location.hash = 'dots-boxes'
  }

  function handleBack() {
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null }
    startedRef.current    = false
    modeRef.current       = null

    setMode(null)
    setIsInvite(false)
    setInviteRoomId(null)
    setJoinError('')
    window.location.hash = 'dots-boxes'
    setScreen('home')
  }

  // ── Screens ───────────────────────────────────────────────────────────────
  if (screen === 'home') {
    return (
      <div className="game">
        <div className="header">
          <div className="header-left">
            <button className="icon-btn" onClick={onHome}>←</button>
          </div>
          <h1>Dots &amp; Boxes</h1>
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
              <span className="mode-desc">Play against 1–3 bots — instant opponent</span>
            </span>
          </button>
          <button
            className="mode-card"
            onClick={() => { setMode('friend'); modeRef.current = 'friend'; setScreen('setup') }}
          >
            <span className="mode-icon">👥</span>
            <span className="mode-text">
              <span className="mode-name">vs Friend</span>
              <span className="mode-desc">Share a link and play online — 2–4 players</span>
            </span>
          </button>
        </div>

        {showInfo && <DBInfoModal onClose={() => setShowInfo(false)} />}
      </div>
    )
  }

  if (screen === 'setup') {
    return (
      <DBSetup
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
      <DBLobby
        roomId={roomId}
        playerCount={targetPlayerCount}
        players={players}
        myPlayerId={myPlayerId}
        onBack={handleBack}
      />
    )
  }

  if (screen === 'game' && gameState) {
    return (
      <DBGame
        players={players}
        mySlot={mySlot}
        mode={mode}
        difficulty={difficulty}
        gameState={gameState}
        onMove={handleMove}
        onHome={onHome}
        onGameOver={() => {
          setFinalState(gameStateRef.current)
          setScreen('result')
        }}
      />
    )
  }

  if (screen === 'result') {
    const gs = finalState || gameState
    return (
      <DBResult
        players={players}
        scores={gs?.scores || {}}
        onPlayAgain={handlePlayAgain}
        onHome={onHome}
      />
    )
  }

  return null
}
