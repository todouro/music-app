import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { EllipsisVertical } from 'lucide-react'
import { PencilFilled, PlusFilled, TrashFilled } from './icons'
import { favoritesId } from '../store/useMusicStore'
import type { Playlist } from '../types'

export type PlaylistActionMenuProps = {
  playlist: Playlist
  onAddToPlaylist?: (playlist: Playlist) => void
  onRenamePlaylist: (playlist: Playlist) => void
  onDeletePlaylist: (playlist: Playlist) => void
}

export function PlaylistActionMenu({
  playlist,
  onAddToPlaylist,
  onRenamePlaylist,
  onDeletePlaylist,
}: PlaylistActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const isProtectedPlaylist = playlist.id === favoritesId

  useEffect(() => {
    if (!isOpen) return
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setIsOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOpen])

  const runAction = (event: MouseEvent<HTMLButtonElement>, action: () => void) => {
    event.preventDefault()
    event.stopPropagation()
    setIsOpen(false)
    action()
  }

  return (
    <div ref={menuRef} className="playlist-action-menu" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className="playlist-more-btn"
        aria-label={`Playlist actions for ${playlist.name}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={`Playlist actions for "${playlist.name}"`}
        onClick={(event) => {
          event.stopPropagation()
          setIsOpen((open) => !open)
        }}
      >
        <EllipsisVertical size={18} />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="playlist-actions"
            className="playlist-action-menu-popover"
            role="menu"
            aria-label={`Actions for ${playlist.name}`}
            initial={{ opacity: 0, y: -5, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -3, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
          >
            <button
              type="button"
              role="menuitem"
              className="playlist-action-menu-item"
              disabled={!onAddToPlaylist}
              onClick={(event) => runAction(event, () => onAddToPlaylist?.(playlist))}
            >
              <PlusFilled size={14} />
              <span>Add to playlist</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="playlist-action-menu-item"
              disabled={isProtectedPlaylist}
              title={isProtectedPlaylist ? 'Favorites cannot be renamed' : undefined}
              onClick={(event) => runAction(event, () => onRenamePlaylist(playlist))}
            >
              <PencilFilled size={14} />
              <span>Rename</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="playlist-action-menu-item danger"
              disabled={isProtectedPlaylist}
              title={isProtectedPlaylist ? 'Favorites cannot be deleted' : undefined}
              onClick={(event) => runAction(event, () => onDeletePlaylist(playlist))}
            >
              <TrashFilled size={14} />
              <span>Delete</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default PlaylistActionMenu
