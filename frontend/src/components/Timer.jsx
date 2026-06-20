import { useState, useEffect, useRef } from 'react'

export default function Timer({ duration, onExpire, resetKey }) {
  const [timeLeft, setTimeLeft] = useState(duration)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  useEffect(() => {
    setTimeLeft(duration)
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(id)
          onExpireRef.current()
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [resetKey, duration])

  const pct = (timeLeft / duration) * 100
  const urgent = timeLeft <= 5
  const warning = timeLeft <= 10

  return (
    <div className={`timer${urgent ? ' timer-urgent' : ''}`}>
      <div className="timer-bar-bg">
        <div
          className="timer-bar"
          style={{
            width: `${pct}%`,
            background: urgent ? '#ff6b6b' : warning ? '#b59f3b' : '#538d4e',
          }}
        />
      </div>
      <span className="timer-count" style={{ color: urgent ? '#ff6b6b' : warning ? '#b59f3b' : '#fff' }}>
        {timeLeft}s
      </span>
    </div>
  )
}
