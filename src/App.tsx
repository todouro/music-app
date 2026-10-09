import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import './App.css'
import {
  PencilFilled,
  PlusFilled,
  SearchFilled,
  TrashFilled,
} from './components/icons'
import {
  AddToPlaylistModal,
  DeletePlaylistModal,
  EditTrackModal,
  HeroPlayer,
  NotificationToast,
  PlayerBar,
  RenamePlaylistModal,
  SettingsModal,
  Sidebar,
  TrackList,
} from './components'
import {
  useAudioPlayback,
  useHeroTheme,
  useKeyboardShortcuts,
  useLibraryImport,
  usePlaylistManager,
  useTrackFilter,
} from './hooks'
import { favoritesId, useMusicStore } from './store/useMusicStore'
import { showToast } from './store/useToastStore'
import { cleanDisplayTitle, formatTime } from './utils/library'
import type { Playlist, Track } from './types'

function App() {
  const [editingTrack, setEditingTrack] = useState<Track | null>(null)
  const [playlistToAddSongs, setPlaylistToAddSongs] = useState<Playlist | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const {
    tracks,
    playlists,
    activePlaylistId,
    isPlaying,
    shuffle,
    repeat,
    themeMode,
    volume,
    initDesktopStorage,
    setActivePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    toggleShuffle,
    cycleRepeat,
    setVolume,
    updateTrack,
  } = useMusicStore()

  // Initialize desktop local database storage on launch
  useEffect(() => {
    initDesktopStorage()
  }, [initDesktopStorage])

  // 1. Playlist and queue management
  const {
    queueRef,
    activePlaylist,
    newPlaylistName,
    setNewPlaylistName,
    handleCreatePlaylist,
    playlistToDelete,
    setPlaylistToDelete,
    handleConfirmDelete,
    playlistToRename,
    setPlaylistToRename,
    handleConfirmRename,
  } = usePlaylistManager()

  // 2. Search and track filtering
  const { query, setQuery, visibleTracks, totalDuration, trackCount } =
    useTrackFilter(tracks, activePlaylistId, activePlaylist)

  // 3. Audio playback lifecycle & synchronization
  const {
    audioRef,
    seek,
    currentTrack,
    handleSeek,
    playPrevious,
    playNext,
    handleTrackPlay,
    togglePlay,
  } = useAudioPlayback(queueRef)

  // 4. File importing & drag/drop (supporting both native dialogs & web drag/drop)
  const {
    isDesktop,
    musicFolderName,
    coverFolderName,
    isScanningMusic,
    isScanningCovers,
    scanNotice,
    handleNativeAddSongs,
    handleNativeMusicFolder,
    handleNativeCoverFolder,
    handleRescanMusicFolder,
    handleRescanCoverFolder,
    handleMusicFiles,
    handleMusicFolder,
    handleCoverFolder,
    handleDrop,
  } = useLibraryImport()

  // 5. Global keyboard shortcuts (e.g. Space to play/pause, media keys)
  useKeyboardShortcuts({
    onTogglePlay: () => togglePlay(visibleTracks[0]?.id, visibleTracks.map((t) => t.id)),
    onPrevious: playPrevious,
    onNext: playNext,
  })

  // 6. Dynamic cover color accent theme
  const heroTheme = useHeroTheme(currentTrack?.coverUrl, currentTrack?.accent)

  // 7. Favorites toggle handler
  const favoritesPlaylist = playlists.find((p) => p.id === favoritesId)
  const favoriteTrackIds = new Set(favoritesPlaylist?.trackIds ?? [])

  const handleToggleFavorite = (trackId: string) => {
    const trk = tracks.find((t) => t.id === trackId)
    const title = trk ? cleanDisplayTitle(trk.title) : 'Song'
    if (favoriteTrackIds.has(trackId)) {
      removeTrackFromPlaylist(favoritesId, trackId)
      showToast(`Removed "${title}" from Favorites`, {
        title: 'Favorites',
        type: 'info',
      })
    } else {
      addTrackToPlaylist(favoritesId, trackId)
      showToast(`Added "${title}" to Favorites`, {
        title: 'Favorites',
        type: 'success',
      })
    }
  }

  const isAmbient = themeMode === 'ambient'

  return (
    <main
      className={`app-shell theme-${themeMode}`}
      style={
        {
          '--ambient-bg': isAmbient ? heroTheme.heroBg : 'transparent',
          '--ambient-deep': isAmbient ? heroTheme.heroBgDeep : 'transparent',
          '--ambient-border': isAmbient ? heroTheme.borderColor : 'var(--line)',
          '--ambient-shadow': isAmbient ? heroTheme.shadowColor : 'rgba(0, 0, 0, 0.45)',
          '--hero-background': isAmbient ? heroTheme.background : 'var(--panel)',
        } as CSSProperties
      }
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <Sidebar
        activePlaylistId={activePlaylistId}
        playlists={playlists}
        tracks={tracks}
        onSelect={setActivePlaylist}
        onCreate={handleCreatePlaylist}
        onRenamePlaylist={setPlaylistToRename}
        onDeletePlaylist={setPlaylistToDelete}
        onOpenAddToPlaylist={setPlaylistToAddSongs}
        playlistName={newPlaylistName}
        setPlaylistName={setNewPlaylistName}
        onAddSongs={handleMusicFiles}
        onAddMusicFolder={handleMusicFolder}
        onAddCoverFolder={handleCoverFolder}
        isDesktop={isDesktop}
        onNativeAddSongs={handleNativeAddSongs}
        onNativeMusicFolder={handleNativeMusicFolder}
        onNativeCoverFolder={handleNativeCoverFolder}
        onRescanMusicFolder={handleRescanMusicFolder}
        onRescanCoverFolder={handleRescanCoverFolder}
        isScanningMusic={isScanningMusic}
        isScanningCovers={isScanningCovers}
        musicFolderName={musicFolderName}
        coverFolderName={coverFolderName}
        scanNotice={scanNotice}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <section className="content">
        <header className="topbar">
          <div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activePlaylistId}
                className="topbar-title-row"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
              >
                <h1>{activePlaylist?.name ?? 'Your Library'}</h1>
                {activePlaylist && (
                  <div className="playlist-header-actions">
                    <button
                      type="button"
                      className="add-to-playlist-header-btn"
                      onClick={() => setPlaylistToAddSongs(activePlaylist)}
                      title={`Add songs to "${activePlaylist.name}"`}
                    >
                      <PlusFilled size={14} />
                      <span>Add to playlist</span>
                    </button>
                    <button
                      type="button"
                      className="edit-playlist-header-btn"
                      onClick={() => setPlaylistToRename(activePlaylist)}
                      title={`Rename playlist "${activePlaylist.name}"`}
                    >
                      <PencilFilled size={14} />
                      <span>Rename</span>
                    </button>
                    <button
                      type="button"
                      className="delete-playlist-header-btn"
                      onClick={() => setPlaylistToDelete(activePlaylist)}
                      title={`Delete playlist "${activePlaylist.name}"`}
                    >
                      <TrashFilled size={14} />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </header>

        <HeroPlayer
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          heroTheme={heroTheme}
          onTogglePlay={() => togglePlay(visibleTracks[0]?.id, visibleTracks.map((t) => t.id))}
        />

        <section className="library-tools">
          <label className="search-box">
            <SearchFilled size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search songs, artists, albums"
            />
          </label>
          <div className="library-stats">
            {activePlaylist && (
              <button
                type="button"
                className="library-tool-add-btn"
                onClick={() => setPlaylistToAddSongs(activePlaylist)}
                title={`Add songs to "${activePlaylist.name}"`}
              >
                <PlusFilled size={14} />
                <span>Add to playlist</span>
              </button>
            )}
            <span>
              {trackCount} {trackCount === 1 ? 'song' : 'songs'} · {formatTime(totalDuration)}
            </span>
          </div>
        </section>

        <TrackList
          tracks={visibleTracks}
          playlists={playlists}
          activePlaylistId={activePlaylistId}
          activePlaylist={activePlaylist}
          currentTrackId={currentTrack?.id}
          isPlaying={isPlaying}
          onPlay={(trackId) => handleTrackPlay(trackId, visibleTracks.map((t) => t.id))}
          onToggleFavorite={handleToggleFavorite}
          onOpenAddToPlaylist={setPlaylistToAddSongs}
          onRemoveFromPlaylist={(playlistId, trackId) => {
            removeTrackFromPlaylist(playlistId, trackId)
            const pl = playlists.find((p) => p.id === playlistId)
            const trk = tracks.find((t) => t.id === trackId)
            showToast(
              trk
                ? `Removed "${cleanDisplayTitle(trk.title)}" from ${pl?.name ?? 'playlist'}`
                : `Removed from ${pl?.name ?? 'playlist'}`,
              { title: 'Playlist Updated', type: 'info' },
            )
          }}
          onEditTrack={setEditingTrack}
          onAddSongs={handleMusicFiles}
          onAddMusicFolder={handleMusicFolder}
          onAddCoverFolder={handleCoverFolder}
          isDesktop={isDesktop}
          onNativeAddSongs={handleNativeAddSongs}
          onNativeMusicFolder={handleNativeMusicFolder}
          onNativeCoverFolder={handleNativeCoverFolder}
        />
      </section>

      <PlayerBar
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        audioRef={audioRef}
        seek={seek}
        shuffle={shuffle}
        repeat={repeat}
        volume={volume}
        onTogglePlay={() => togglePlay(visibleTracks[0]?.id, visibleTracks.map((t) => t.id))}
        onPrevious={playPrevious}
        onNext={playNext}
        onSeek={handleSeek}
        onShuffle={toggleShuffle}
        onRepeat={cycleRepeat}
        onVolume={setVolume}
      />

      <AnimatePresence>
        {playlistToAddSongs && (
          <AddToPlaylistModal
            key="add-to-playlist-modal"
            playlist={
              playlists.find((p) => p.id === playlistToAddSongs.id) ?? playlistToAddSongs
            }
            allTracks={tracks}
            onClose={() => setPlaylistToAddSongs(null)}
            onAddTrack={(playlistId, trackId) => {
              addTrackToPlaylist(playlistId, trackId)
              const pl = playlists.find((p) => p.id === playlistId)
              const trk = tracks.find((t) => t.id === trackId)
              showToast(
                trk
                  ? `Added "${cleanDisplayTitle(trk.title)}" to ${pl?.name ?? 'playlist'}`
                  : 'Added to playlist',
                { title: 'Playlist Updated', type: 'success' },
              )
            }}
            onRemoveTrack={(playlistId, trackId) => {
              removeTrackFromPlaylist(playlistId, trackId)
              const pl = playlists.find((p) => p.id === playlistId)
              const trk = tracks.find((t) => t.id === trackId)
              showToast(
                trk
                  ? `Removed "${cleanDisplayTitle(trk.title)}" from ${pl?.name ?? 'playlist'}`
                  : 'Removed from playlist',
                { title: 'Playlist Updated', type: 'info' },
              )
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingTrack && (
          <EditTrackModal
            key="edit-track-modal"
            track={editingTrack}
            isPlaying={isPlaying}
            onClose={() => setEditingTrack(null)}
            onSave={(updates) => {
              updateTrack(editingTrack.id, updates)
              showToast('Track details saved successfully', { title: 'Track Updated', type: 'success' })
              setEditingTrack(null)
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {playlistToRename && (
          <RenamePlaylistModal
            key="rename-playlist-modal"
            playlist={playlistToRename}
            onClose={() => setPlaylistToRename(null)}
            onSave={handleConfirmRename}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {playlistToDelete && (
          <DeletePlaylistModal
            key="delete-playlist-modal"
            playlist={playlistToDelete}
            onClose={() => setPlaylistToDelete(null)}
            onConfirm={handleConfirmDelete}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSettingsOpen && (
          <SettingsModal
            key="settings-modal"
            onClose={() => setIsSettingsOpen(false)}
          />
        )}
      </AnimatePresence>

      <NotificationToast />
    </main>
  )
}

export default App
