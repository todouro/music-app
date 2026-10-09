import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { CloseFilled, TrashFilled } from '../icons'
import type { Playlist } from '../../types'

export type DeletePlaylistModalProps = {
  playlist: Playlist
  onClose: () => void
  onConfirm: () => void
}

export function DeletePlaylistModal({ playlist, onClose, onConfirm }: DeletePlaylistModalProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <motion.div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-playlist-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="modal-card modal-card-sm"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ type: 'spring', damping: 26, stiffness: 380 }}
      >
        <header className="modal-header">
          <div className="delete-modal-title-group">
            <div className="delete-modal-icon-badge">
              <TrashFilled size={18} />
            </div>
            <div>
              <h3 id="delete-playlist-title">Delete Playlist</h3>
              <p className="delete-modal-subtitle">This action cannot be undone.</p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <CloseFilled size={18} />
          </button>
        </header>

        <div className="modal-body delete-modal-body">
          <p>
            Are you sure you want to delete <strong>{playlist.name}</strong>?
          </p>
          <p className="delete-modal-note">
            The {playlist.trackIds.length} {playlist.trackIds.length === 1 ? 'song' : 'songs'} in this playlist will remain in your library.
          </p>
        </div>

        <footer className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={() => {
              onConfirm()
              onClose()
            }}
            autoFocus
          >
            <TrashFilled size={15} />
            <span>Delete playlist</span>
          </button>
        </footer>
      </motion.div>
    </motion.div>
  )
}

export default DeletePlaylistModal
