import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent, RefObject } from 'react'
import { motion } from 'framer-motion'
import type { Howl } from 'howler'
import ElasticSlider from './ElasticSlider'
import {
  DiscFilled,
  PauseFilled,
  PlayFilled,
  RepeatFilled,
  RepeatOneFilled,
  ShuffleFilled,
  SkipBackFilled,
  SkipForwardFilled,
} from './icons'
import { cleanDisplayTitle, formatTime } from '../utils/library'
import type { Track } from '../types'

export type PlayerBarProps = {
  currentTrack?: Track
  isPlaying: boolean
  audioRef: RefObject<Howl | null>
  seek: number
  shuffle: boolean
  repeat: string
  volume: number
  onTogglePlay: () => void
  onPrevious: () => void
  onNext: () => void
  onSeek: (value: number) => void
  onShuffle: () => void
  onRepeat: () => void
  onVolume: (value: number) => void
}

export function PlayerBar({
  currentTrack,
  isPlaying,
  audioRef,
  seek,
  shuffle,
  repeat,
  volume,
  onTogglePlay,
  onPrevious,
  onNext,
  onSeek,
  onShuffle,
  onRepeat,
  onVolume,
}: PlayerBarProps) {
  const duration = currentTrack?.duration ?? 0

  // Scrubber refs & state
  const trackRef = useRef<HTMLDivElement>(null)
  const fillRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const timeLabelRef = useRef<HTMLSpanElement>(null)
  const isDraggingRef = useRef(false)
  const rafRef = useRef<number | null>(null)

  const [isDragging, setIsDragging] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [hoverPct, setHoverPct] = useState(0)
  const [hoverTime, setHoverTime] = useState(0)

  // 60fps continuous animation frame for seamless, smooth progression
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      return
    }

    let lastSec = -1

    const loop = () => {
      const howl = audioRef.current
      if (howl && isPlaying && !isDraggingRef.current) {
        const pos = howl.seek()
        if (typeof pos === 'number' && !Number.isNaN(pos)) {
          const clampedPos = duration > 0 ? Math.min(pos, duration) : pos
          const pct = duration > 0 ? (clampedPos / duration) * 100 : 0

          if (fillRef.current) {
            fillRef.current.style.width = `${pct}%`
          }
          if (thumbRef.current) {
            thumbRef.current.style.left = `${pct}%`
          }

          const currentSec = Math.floor(clampedPos)
          if (currentSec !== lastSec) {
            lastSec = currentSec
            if (timeLabelRef.current) {
              timeLabelRef.current.textContent = formatTime(clampedPos)
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [isPlaying, audioRef, duration])

  // Sync on track switch, pause, or external seek
  useEffect(() => {
    if (!isDraggingRef.current) {
      const pct = duration > 0 ? (Math.min(seek, duration) / duration) * 100 : 0
      if (fillRef.current) {
        fillRef.current.style.width = `${pct}%`
      }
      if (thumbRef.current) {
        thumbRef.current.style.left = `${pct}%`
      }
      if (timeLabelRef.current) {
        timeLabelRef.current.textContent = formatTime(seek)
      }
    }
  }, [seek, duration, currentTrack?.id])

  const getTimeFromPointer = useCallback(
    (clientX: number) => {
      if (!trackRef.current || duration <= 0) return 0
      const rect = trackRef.current.getBoundingClientRect()
      if (rect.width <= 0) return 0
      const relative = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      return relative * duration
    },
    [duration],
  )

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (duration <= 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    isDraggingRef.current = true
    setIsDragging(true)

    const targetTime = getTimeFromPointer(e.clientX)
    const pct = (targetTime / duration) * 100

    if (fillRef.current) fillRef.current.style.width = `${pct}%`
    if (thumbRef.current) thumbRef.current.style.left = `${pct}%`
    if (timeLabelRef.current) timeLabelRef.current.textContent = formatTime(targetTime)
  }

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (duration <= 0 || !trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const relative = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const calculatedTime = relative * duration

    setHoverPct(relative * 100)
    setHoverTime(calculatedTime)

    if (isDraggingRef.current) {
      const pct = relative * 100
      if (fillRef.current) fillRef.current.style.width = `${pct}%`
      if (thumbRef.current) thumbRef.current.style.left = `${pct}%`
      if (timeLabelRef.current) timeLabelRef.current.textContent = formatTime(calculatedTime)
    }
  }

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      isDraggingRef.current = false
      setIsDragging(false)
      const finalTime = getTimeFromPointer(e.clientX)
      onSeek(finalTime)
    }
  }

  const initialPct = duration > 0 ? (Math.min(seek, duration) / duration) * 100 : 0

  return (
    <footer className="player-bar">
      {/* 1. Track Info on Left */}
      <div className="player-track">
        <div
          className="mini-cover large"
          style={{ '--cover-accent': currentTrack?.accent } as CSSProperties}
        >
          {currentTrack?.coverUrl ? (
            <img src={currentTrack.coverUrl} alt="" />
          ) : (
            <DiscFilled size={22} />
          )}
        </div>
        <div>
          <strong>
            {currentTrack ? cleanDisplayTitle(currentTrack.title) : 'No track selected'}
          </strong>
          <span>{currentTrack?.artist ?? 'Choose a song to start'}</span>
        </div>
      </div>

      {/* 2. Center Transport Controls & Modern Scrubber */}
      <div className="transport">
        <div className="transport-buttons">
          <motion.button
            className={shuffle ? 'control active' : 'control'}
            type="button"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={onShuffle}
            aria-label="Toggle shuffle"
          >
            <ShuffleFilled size={18} />
          </motion.button>
          <motion.button
            className="control"
            type="button"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={onPrevious}
            aria-label="Previous track"
          >
            <SkipBackFilled size={20} />
          </motion.button>
          <motion.button
            className="play-button"
            type="button"
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.92 }}
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <PauseFilled size={24} /> : <PlayFilled size={24} />}
          </motion.button>
          <motion.button
            className="control"
            type="button"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={onNext}
            aria-label="Next track"
          >
            <SkipForwardFilled size={20} />
          </motion.button>
          <motion.button
            className={repeat !== 'off' ? 'control active' : 'control'}
            type="button"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={onRepeat}
            aria-label="Cycle repeat mode"
          >
            {repeat === 'one' ? <RepeatOneFilled size={18} /> : <RepeatFilled size={18} />}
          </motion.button>
        </div>

        {/* Brand-new Modern Audio Progress Scrubber */}
        <div className="progress-line">
          <div className="modern-scrubber-row">
            <span ref={timeLabelRef} className="scrubber-timestamp current">
              {formatTime(seek)}
            </span>

            <div
              ref={trackRef}
              className={`scrubber-hitbox ${isHovered || isDragging ? 'active' : ''}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onPointerEnter={() => setIsHovered(true)}
              onPointerLeave={() => {
                if (!isDragging) setIsHovered(false)
              }}
              role="slider"
              tabIndex={0}
              aria-label="Playback progress"
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-valuenow={seek}
              aria-valuetext={`${formatTime(seek)} of ${formatTime(duration)}`}
              onKeyDown={(e) => {
                if (duration <= 0) return
                if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                  e.preventDefault()
                  onSeek(Math.min(duration, seek + 5))
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                  e.preventDefault()
                  onSeek(Math.max(0, seek - 5))
                } else if (e.key === 'Home') {
                  e.preventDefault()
                  onSeek(0)
                } else if (e.key === 'End') {
                  e.preventDefault()
                  onSeek(duration)
                }
              }}
            >
              <div className="scrubber-rail">
                {/* Hover preview ghost bar */}
                {isHovered && duration > 0 && (
                  <div
                    className="scrubber-hover-ghost"
                    style={{ width: `${hoverPct}%` }}
                  />
                )}

                {/* Active playback fill */}
                <div
                  ref={fillRef}
                  className="scrubber-fill"
                  style={{ width: `${initialPct}%` }}
                />

                {/* Draggable thumb handle */}
                <div
                  ref={thumbRef}
                  className="scrubber-thumb"
                  style={{ left: `${initialPct}%` }}
                />
              </div>

              {/* Hover timestamp tooltip */}
              {isHovered && duration > 0 && (
                <div className="scrubber-tooltip" style={{ left: `${hoverPct}%` }}>
                  {formatTime(hoverTime)}
                </div>
              )}
            </div>

            <span className="scrubber-timestamp total">{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* 3. Brand-new Modern Volume Controller on Right */}
      <div className="volume">
        <ElasticSlider value={volume} onChange={onVolume} />
      </div>
    </footer>
  )
}

export default PlayerBar
