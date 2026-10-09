import { useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties, FormEvent } from 'react'
import { motion } from 'framer-motion'
import {
  CloseFilled,
  DiscFilled,
  ImageFilled,
  TrashFilled,
  UploadFilled,
} from '../icons'
import { cleanDisplayTitle } from '../../utils/library'
import { isDesktopApp, pickNativeImageFile, toNativeAssetUrl } from '../../utils/platform'
import { processTrackEdit } from '../../utils/trackEdit'
import type { Track } from '../../types'

export type EditTrackModalProps = {
  track: Track
  isPlaying: boolean
  onClose: () => void
  onSave: (updates: Partial<Track>) => void
}

export function EditTrackModal({ track, isPlaying, onClose, onSave }: EditTrackModalProps) {
  const [title, setTitle] = useState(cleanDisplayTitle(track.title))
  const [artist, setArtist] = useState(track.artist)
  const [album, setAlbum] = useState(track.album)
  const [coverUrl, setCoverUrl] = useState<string | undefined>(track.coverUrl)
  const [coverPath, setCoverPath] = useState<string | undefined>(track.coverPath)
  const [pendingImageSource, setPendingImageSource] = useState<string | undefined>(undefined)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isDesktop = isDesktopApp()

  async function handleNativeChooseImage() {
    setErrorMessage(null)
    const selected = await pickNativeImageFile()
    if (selected) {
      setCoverPath(selected)
      setCoverUrl(toNativeAssetUrl(selected))
      setPendingImageSource(selected)
    }
  }

  function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    setErrorMessage(null)
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      setCoverUrl(dataUrl)
      setCoverPath(undefined)
      setPendingImageSource(dataUrl)
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  function handleRemoveCover() {
    setErrorMessage(null)
    setCoverUrl(undefined)
    setCoverPath(undefined)
    setPendingImageSource(undefined)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErrorMessage(null)
    setIsSaving(true)

    const result = await processTrackEdit({
      track,
      title,
      artist,
      album,
      coverUrl,
      coverPath,
      pendingImageSource,
      isDesktop,
    })

    setIsSaving(false)

    if (!result.success) {
      setErrorMessage(result.errorMessage || 'Failed to save custom artwork.')
      return
    }

    if (result.updates) {
      onSave(result.updates)
    }
    onClose()
  }

  return (
    <motion.div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-modal-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ type: 'spring', damping: 26, stiffness: 380 }}
      >
        <header className="modal-header">
          <h3 id="edit-modal-title">Edit Track Details</h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close edit dialog"
          >
            <CloseFilled size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="modal-body">
          {errorMessage && (
            <div
              className="modal-error-banner"
              role="alert"
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#fca5a5',
                fontSize: '13px',
                marginBottom: '16px',
              }}
            >
              {errorMessage}
            </div>
          )}

          {/* Cover Art Upload & CD Preview */}
          <div className="cover-upload-section">
            <div className="cover-preview-box">
              {coverUrl ? (
                <img src={coverUrl} alt="Cover preview" />
              ) : (
                <div className="cover-preview-empty">
                  <ImageFilled size={26} />
                  <span>No cover</span>
                </div>
              )}
            </div>

            <div className="cover-preview-cd">
              <div
                className={`cd-disc ${isPlaying ? 'is-playing' : 'is-paused'}`}
                style={{ width: 84, height: 84 }}
              >
                <div className="cd-base" />
                {coverUrl ? (
                  <div className="cd-artwork-layer">
                    <img src={coverUrl} alt="Cover CD preview" className="cd-artwork-img" />
                  </div>
                ) : (
                  <div
                    className="cd-artwork-layer cd-generated-artwork"
                    style={{ '--cover-accent': track.accent } as CSSProperties}
                  >
                    <div className="cd-generated-pattern" />
                    <DiscFilled size={20} color="#0b0c0b" />
                  </div>
                )}
                <div className="cd-grooves" />
                <div className="cd-spectral-sheen" />
                <div className="cd-surface-glare" />
                <div className="cd-hub-area">
                  <div className="cd-hub-inner-ridge" />
                  <div className="cd-center-hole" />
                </div>
                <div className="cd-outer-rim" />
              </div>
            </div>

            <div className="cover-upload-controls">
              <p>Upload artwork to display on the spinning CD disc.</p>
              <div className="cover-upload-actions">
                {isDesktop ? (
                  <button
                    type="button"
                    className="upload-file-btn"
                    onClick={handleNativeChooseImage}
                  >
                    <UploadFilled size={14} />
                    <span>{coverUrl ? 'Replace Art' : 'Upload Art'}</span>
                  </button>
                ) : (
                  <label className="upload-file-btn">
                    <UploadFilled size={14} />
                    <span>{coverUrl ? 'Replace Art' : 'Upload Art'}</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                    />
                  </label>
                )}
                {coverUrl && (
                  <button
                    type="button"
                    className="remove-cover-btn"
                    onClick={handleRemoveCover}
                    title="Remove custom artwork"
                  >
                    <TrashFilled size={14} />
                    <span>Remove</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="edit-title">Song Title</label>
            <input
              id="edit-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Lover Is a Day"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-artist">Artist</label>
            <input
              id="edit-artist"
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="e.g. Cuco"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-album">Album</label>
            <input
              id="edit-album"
              type="text"
              value={album}
              onChange={(e) => setAlbum(e.target.value)}
              placeholder="e.g. Local files"
            />
          </div>

          <footer className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </footer>
        </form>
      </motion.div>
    </motion.div>
  )
}

export default EditTrackModal
