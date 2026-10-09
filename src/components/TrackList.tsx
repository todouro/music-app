import { AnimatePresence, motion } from 'framer-motion'
import type { ChangeEvent, CSSProperties } from 'react'
import {
  CloseFilled,
  DiscFilled,
  FolderImageFilled,
  FolderMusicFilled,
  HeartFilled,
  HeartOutline,
  PauseFilled,
  PencilFilled,
  PlayFilled,
  PlusFilled,
  UploadFilled,
} from './icons'
import { favoritesId, libraryId } from '../store/useMusicStore'
import { cleanDisplayTitle, formatTime } from '../utils/library'
import type { Playlist, Track } from '../types'

export type TrackListProps = {
  tracks: Track[]
  playlists: Playlist[]
  activePlaylistId: string
  activePlaylist?: Playlist
  currentTrackId?: string
  isPlaying: boolean
  onPlay: (trackId: string) => void
  onAddToPlaylist?: (playlistId: string, trackId: string) => void
  onRemoveFromPlaylist?: (playlistId: string, trackId: string) => void
  onToggleFavorite: (trackId: string) => void
  onOpenAddToPlaylist?: (playlist: Playlist) => void
  onEditTrack: (track: Track) => void
  onAddSongs?: (e: ChangeEvent<HTMLInputElement>) => void
  onAddMusicFolder?: (e: ChangeEvent<HTMLInputElement>) => void
  onAddCoverFolder?: (e: ChangeEvent<HTMLInputElement>) => void
  isDesktop?: boolean
  onNativeAddSongs?: () => void
  onNativeMusicFolder?: () => void
  onNativeCoverFolder?: () => void
}

export function TrackList({
  tracks,
  playlists,
  activePlaylistId,
  activePlaylist,
  currentTrackId,
  isPlaying,
  onPlay,
  onRemoveFromPlaylist,
  onToggleFavorite,
  onOpenAddToPlaylist,
  onEditTrack,
  onAddSongs,
  onAddMusicFolder,
  onAddCoverFolder,
  isDesktop = false,
  onNativeAddSongs,
  onNativeMusicFolder,
  onNativeCoverFolder,
}: TrackListProps) {
  const favoritesPlaylist = playlists.find((p) => p.id === favoritesId)
  const favoriteTrackIds = new Set(favoritesPlaylist?.trackIds ?? [])

  if (tracks.length === 0) {
    if (activePlaylistId !== libraryId && activePlaylist) {
      return (
        <motion.div
          className="empty-state empty-playlist-state"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <DiscFilled size={42} />
          <h3>"{activePlaylist.name}" is empty</h3>
          <p>There are no songs in this playlist yet. Add songs from your library.</p>
          {onOpenAddToPlaylist && (
            <div className="empty-state-actions">
              <button
                type="button"
                className="empty-state-btn primary-action"
                onClick={() => onOpenAddToPlaylist(activePlaylist)}
              >
                <PlusFilled size={15} />
                <span>Add to playlist</span>
              </button>
            </div>
          )}
        </motion.div>
      )
    }

    return (
      <motion.div className="empty-state" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
        <DiscFilled size={42} />
        <h3>Your library is waiting</h3>
        <p>Add songs manually or import an entire music folder. Covers will automatically be applied to songs in your library.</p>
        <div className="empty-state-actions">
          {isDesktop && onNativeAddSongs ? (
            <button
              type="button"
              className="empty-state-btn"
              title="Select audio files from your computer"
              onClick={onNativeAddSongs}
            >
              <UploadFilled size={15} />
              <span>Add songs</span>
            </button>
          ) : (
            onAddSongs && (
              <label className="empty-state-btn" title="Manually select audio files">
                <UploadFilled size={15} />
                <span>Add songs</span>
                <input type="file" accept="audio/*" multiple onChange={onAddSongs} />
              </label>
            )
          )}

          {isDesktop && onNativeMusicFolder ? (
            <button
              type="button"
              className="empty-state-btn"
              title="Import an entire music folder from your computer"
              onClick={onNativeMusicFolder}
            >
              <FolderMusicFilled size={15} />
              <span>Music folder</span>
            </button>
          ) : (
            onAddMusicFolder && (
              <label className="empty-state-btn" title="Import an entire music folder">
                <FolderMusicFilled size={15} />
                <span>Music folder</span>
                <input
                  type="file"
                  multiple
                  onChange={onAddMusicFolder}
                  {...{ webkitdirectory: '', directory: '' }}
                />
              </label>
            )
          )}

          {isDesktop && onNativeCoverFolder ? (
            <button
              type="button"
              className="empty-state-btn subtle"
              title="Import a folder of cover artwork from your computer"
              onClick={onNativeCoverFolder}
            >
              <FolderImageFilled size={15} />
              <span>Cover folder</span>
            </button>
          ) : (
            onAddCoverFolder && (
              <label className="empty-state-btn subtle" title="Import a folder of cover artwork">
                <FolderImageFilled size={15} />
                <span>Cover folder</span>
                <input
                  type="file"
                  multiple
                  onChange={onAddCoverFolder}
                  {...{ webkitdirectory: '', directory: '' }}
                />
              </label>
            )
          )}
        </div>
      </motion.div>
    )
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={activePlaylistId}
        className="track-list"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        {tracks.map((track, index) => {
          const isFavorited = favoriteTrackIds.has(track.id)
          return (
            <motion.article
              className={currentTrackId === track.id ? 'track-row active' : 'track-row'}
              key={track.id}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '60px 0px' }}
              transition={{
                duration: 0.25,
                ease: [0.22, 1, 0.36, 1],
                delay: Math.min((index % 8) * 0.025, 0.12),
              }}
              whileHover={{ y: -2, scale: 1.003, transition: { duration: 0.15 } }}
              whileTap={{ scale: 0.996 }}
              onClick={() => onPlay(track.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  if (e.target === e.currentTarget) {
                    e.preventDefault()
                    onPlay(track.id)
                  }
                }
              }}
            >
              <motion.button
                className="track-play"
                type="button"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={(e) => {
                  e.stopPropagation()
                  onPlay(track.id)
                }}
                title={currentTrackId === track.id && isPlaying ? 'Pause' : 'Play'}
                aria-label={currentTrackId === track.id && isPlaying ? 'Pause' : 'Play'}
              >
                {currentTrackId === track.id && isPlaying ? (
                  <PauseFilled size={18} />
                ) : (
                  <PlayFilled size={18} />
                )}
              </motion.button>
              <div className="mini-cover" style={{ '--cover-accent': track.accent } as CSSProperties}>
                {track.coverUrl ? <img src={track.coverUrl} alt="" /> : <DiscFilled size={20} />}
              </div>
              <div className="track-meta">
                <div className="track-title-row">
                  <strong>{cleanDisplayTitle(track.title)}</strong>
                  {currentTrackId === track.id && isPlaying && (
                    <div className="track-equalizer" title="Playing" aria-label="Now playing">
                      <span className="eq-bar eq-1" />
                      <span className="eq-bar eq-2" />
                      <span className="eq-bar eq-3" />
                    </div>
                  )}
                </div>
                <span>{track.artist}</span>
              </div>
              <span className="track-album">{track.album}</span>
              <span className="track-time">{formatTime(track.duration)}</span>

              {/* Heart button to automatically add/remove from Favorites */}
              <motion.button
                type="button"
                className={`track-heart-btn ${isFavorited ? 'is-favorited' : ''}`}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.85 }}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleFavorite(track.id)
                }}
                title={
                  isFavorited
                    ? `Remove "${cleanDisplayTitle(track.title)}" from Favorites`
                    : `Add "${cleanDisplayTitle(track.title)}" to Favorites`
                }
                aria-label={
                  isFavorited
                    ? `Remove "${cleanDisplayTitle(track.title)}" from Favorites`
                    : `Add "${cleanDisplayTitle(track.title)}" to Favorites`
                }
              >
                {isFavorited ? (
                  <HeartFilled size={19} color="#ff3b69" className="heart-icon-filled" />
                ) : (
                  <HeartOutline size={19} className="heart-icon-outline" />
                )}
              </motion.button>

              <div className="track-row-btns" onClick={(e) => e.stopPropagation()}>
                <motion.button
                  type="button"
                  className="track-edit-btn"
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onEditTrack(track)
                  }}
                  title={`Rename or edit details for ${cleanDisplayTitle(track.title)}`}
                  aria-label={`Edit ${cleanDisplayTitle(track.title)}`}
                >
                  <PencilFilled size={15} />
                </motion.button>
                {activePlaylistId !== libraryId && (
                  <motion.button
                    type="button"
                    className="track-remove-from-playlist-btn"
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveFromPlaylist?.(activePlaylistId, track.id)
                    }}
                    title={`Remove "${cleanDisplayTitle(track.title)}" from ${activePlaylist?.name ?? 'playlist'}`}
                    aria-label={`Remove "${cleanDisplayTitle(track.title)}" from ${activePlaylist?.name ?? 'playlist'}`}
                  >
                    <CloseFilled size={15} />
                  </motion.button>
                )}
              </div>
            </motion.article>
          )
        })}
      </motion.div>
    </AnimatePresence>
  )
}

export default TrackList
