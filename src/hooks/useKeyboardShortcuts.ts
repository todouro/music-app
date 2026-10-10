import { useEffect } from 'react'

export interface KeyboardShortcutHandlers {
  onTogglePlay: () => void
  onPrevious: () => void
  onNext: () => void
  onSeekBackward?: () => void
  onSeekForward?: () => void
  onVolumeUp?: () => void
  onVolumeDown?: () => void
  onToggleMute?: () => void
  onToggleShuffle?: () => void
  onCycleRepeat?: () => void
}

export function useKeyboardShortcuts({
  onTogglePlay,
  onPrevious,
  onNext,
  onSeekBackward,
  onSeekForward,
  onVolumeUp,
  onVolumeDown,
  onToggleMute,
  onToggleShuffle,
  onCycleRepeat,
}: KeyboardShortcutHandlers) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)

      if (isInput) return

      if (event.code === 'Space') {
        event.preventDefault()
        onTogglePlay()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        onSeekBackward?.()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        onSeekForward?.()
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        onVolumeUp?.()
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        onVolumeDown?.()
      } else if (event.key === 'm' || event.key === 'M') {
        event.preventDefault()
        onToggleMute?.()
      } else if (event.key === 's' || event.key === 'S') {
        event.preventDefault()
        onToggleShuffle?.()
      } else if (event.key === 'r' || event.key === 'R') {
        event.preventDefault()
        onCycleRepeat?.()
      } else if (event.key === 'MediaTrackPrevious') {
        event.preventDefault()
        onPrevious()
      } else if (event.key === 'MediaTrackNext') {
        event.preventDefault()
        onNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    onTogglePlay,
    onPrevious,
    onNext,
    onSeekBackward,
    onSeekForward,
    onVolumeUp,
    onVolumeDown,
    onToggleMute,
    onToggleShuffle,
    onCycleRepeat,
  ])
}
