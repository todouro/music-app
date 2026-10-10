import { AnimatePresence, motion } from 'framer-motion'
import type { CSSProperties } from 'react'
import { CdDisc } from './CdDisc'
import { cleanDisplayTitle } from '../utils/library'
import { useMusicStore } from '../store/useMusicStore'
import type { CoverTheme } from '../hooks/useHeroTheme'
import type { Track } from '../types'

export type HeroPlayerProps = {
  currentTrack?: Track
  isPlaying: boolean
  heroTheme: CoverTheme
  onTogglePlay: () => void
}

export function HeroPlayer({
  currentTrack,
  isPlaying,
  heroTheme,
  onTogglePlay,
}: HeroPlayerProps) {
  const showSidewaysVisualizer = useMusicStore((s) => s.showSidewaysVisualizer)

  return (
    <section
      className={`hero-player ${heroTheme.isLight ? 'is-light-theme' : ''}`}
      style={
        {
          '--hero-background': heroTheme.background,
          '--hero-bg': heroTheme.heroBg,
          '--hero-bg-deep': heroTheme.heroBgDeep,
          '--hero-border': heroTheme.borderColor,
          '--hero-shadow': heroTheme.shadowColor,
        } as CSSProperties
      }
    >
      <motion.div
        className="cover-stage"
        layout
        transition={{ type: 'spring', stiffness: 180, damping: 22 }}
      >
        {showSidewaysVisualizer && (
          <div
            className={`sideways-visualizer ${isPlaying ? 'is-playing' : ''}`}
            aria-hidden="true"
          >
            <div className="sideways-wing sideways-left">
              {Array.from({ length: 8 }).map((_, i) => (
                <span key={i} className={`v-bar v-bar-${i + 1}`} />
              ))}
            </div>
            <div className="sideways-wing sideways-right">
              {Array.from({ length: 8 }).map((_, i) => (
                <span key={i} className={`v-bar v-bar-${i + 1}`} />
              ))}
            </div>
          </div>
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTrack?.id ?? 'empty'}
            className="cd-stage-motion"
            initial={{ opacity: 0, scale: 0.93 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.93 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <CdDisc
              track={currentTrack}
              isPlaying={isPlaying}
              onTogglePlay={onTogglePlay}
            />
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <div className="now-copy">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTrack?.id ?? 'no-track'}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.24 }}
            className="hero-track-details"
          >
            <h2 className="hero-track-title">
              {currentTrack ? cleanDisplayTitle(currentTrack.title) : 'Drop in your first track'}
            </h2>
            <div className="hero-track-sub">
              <p className="hero-track-meta">
                {currentTrack ? (
                  <>
                    <span className="hero-track-artist">{currentTrack.artist}</span>
                    {currentTrack.album && (
                      <>
                        <span className="hero-meta-dot">·</span>
                        <span className="hero-track-album">{currentTrack.album}</span>
                      </>
                    )}
                  </>
                ) : (
                  'Import songs, then add cover images or edit track details.'
                )}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait">
        {currentTrack?.coverUrl && (
          <motion.div
            key={currentTrack.coverUrl}
            className="hero-banner-cover-wrap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            aria-hidden="true"
          >
            <div className="hero-banner-ambient">
              <img
                src={currentTrack.coverUrl}
                alt=""
                className="hero-banner-ambient-img"
              />
            </div>
            <div className="hero-banner-cover">
              <img
                src={currentTrack.coverUrl}
                alt=""
                className="hero-banner-cover-img"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

export default HeroPlayer
