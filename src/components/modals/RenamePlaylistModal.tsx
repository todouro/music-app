import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { motion } from 'framer-motion'
import { CloseFilled, PencilFilled } from '../icons'
import type { Playlist } from '../../types'

export type RenamePlaylistModalProps = {
  playlist: Playlist
  onClose: () => void
  onSave: (newName: string) => void
}

export function RenamePlaylistModal({ playlist, onClose, onSave }: RenamePlaylistModalProps) {
  const [name, setName] = useState(playlist.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (trimmed) {
      onSave(trimmed)
      onClose()
    }
  }

  return (
    <motion.div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rename-playlist-title"
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
            <div className="rename-modal-icon-badge">
              <PencilFilled size={18} />
            </div>
            <div>
              <h3 id="rename-playlist-title">Rename Playlist</h3>
              <p className="delete-modal-subtitle">Update playlist display name</p>
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

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label htmlFor="rename-input">Playlist Name</label>
            <input
              ref={inputRef}
              id="rename-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter new name"
              required
            />
          </div>

          <footer className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={!name.trim()}>
              Save Name
            </button>
          </footer>
        </form>
      </motion.div>
    </motion.div>
  )
}

export default RenamePlaylistModal
