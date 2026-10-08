import { AnimatePresence, motion } from 'framer-motion'
import { Howl } from 'howler'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties, FormEvent } from 'react'
import './App.css'
import {
  AudioLinesFilled,
  CheckFilled,
  ChevronDownFilled,
  DiscFilled,
  FolderImageFilled,
  FolderMusicFilled,
  HeartFilled,
  ImageFilled,
  PauseFilled,
  PencilFilled,
  PlayFilled,
  PlaylistFilled,
  PlusFilled,
  RepeatFilled,
  RepeatOneFilled,
  SearchFilled,
  ShuffleFilled,
  SkipBackFilled,
  SkipForwardFilled,
  TrashFilled,
  UploadFilled,
  CloseFilled,
} from './components/icons'
import { favoritesId, libraryId, useMusicStore } from './store/useMusicStore'
import ElasticSlider from './components/ElasticSlider'
import { PlaybackQueue } from './utils/queue'
import { revokeOwnedObjectUrls } from './utils/objectUrls'
import type { Playlist, Track } from './types'
import {
  cleanDisplayTitle,
  extractCovers,
  formatTime,
  getAverageColor,
  hslToRgb,
  isAudioFile,
  isCoverFile,
  tracksFromFiles,
} from './utils/library'

function App() {
  const audioRef = useRef<Howl | null>(null)
  const progressTimer = useRef<number | null>(null)
  const volumeRef = useRef(0.82)
  const playNextRef = useRef<() => void>(() => {})
  const queueRef = useRef(new PlaybackQueue())
  const lastPlaylistIdRef = useRef<string | null>(null)
  const [query, setQuery] = useState('')
  const [seek, setSeek] = useState(0)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [editingTrack, setEditingTrack] = useState<Track | null>(null)
  const [playlistToDelete, setPlaylistToDelete] = useState<Playlist | null>(null)
  const [playlistToRename, setPlaylistToRename] = useState<Playlist | null>(null)
  const [coverColor, setCoverColor] = useState<{
    background: string
    heroBg: string
    heroBgDeep: string
    borderColor: string
    shadowColor: string
    isLight: boolean
  } | null>(null)
  const {
    tracks,
    playlists,
    activePlaylistId,
    currentTrackId,
    isPlaying,
    shuffle,
    repeat,
    volume,
    addTracks,
    addCovers,
    createPlaylist,
    deletePlaylist,
    renamePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    setActivePlaylist,
    setCurrentTrack,
    setIsPlaying,
    toggleShuffle,
    cycleRepeat,
    setVolume,
    updateTrack,
  } = useMusicStore()

  const activePlaylist = playlists.find((playlist) => playlist.id === activePlaylistId)
  const currentTrack = tracks.find((track) => track.id === currentTrackId)
  const currentAudioUrl = currentTrack?.audioUrl
  const currentId = currentTrack?.id
  const visibleTracks = useMemo(
    () => getVisibleTracks(tracks, activePlaylistId, activePlaylist, query),
    [activePlaylist, activePlaylistId, query, tracks],
  )

  const currentCoverUrl = currentTrack?.coverUrl
  const currentAccent = currentTrack?.accent

  useEffect(() => {
    let cancelled = false

    if (currentCoverUrl) {
      getAverageColor(currentCoverUrl).then(({ r, g, b }) => {
        if (cancelled) return
        const avgColor = `rgb(${r}, ${g}, ${b})`
        const deepR = Math.max(0, Math.round(r * 0.45))
        const deepG = Math.max(0, Math.round(g * 0.45))
        const deepB = Math.max(0, Math.round(b * 0.45))
        const deepColor = `rgb(${deepR}, ${deepG}, ${deepB})`
        const isLight = 0.299 * r + 0.587 * g + 0.114 * b > 165
        setCoverColor({
          background: `linear-gradient(135deg, ${avgColor} 0%, ${deepColor} 100%)`,
          heroBg: avgColor,
          heroBgDeep: deepColor,
          borderColor: `rgba(${r}, ${g}, ${b}, 0.45)`,
          shadowColor: `rgba(${r}, ${g}, ${b}, 0.3)`,
          isLight,
        })
      })
    } else {
      const timer = setTimeout(() => {
        if (cancelled) return
        if (currentAccent) {
          const { r, g, b } = hslToRgb(currentAccent)
          const avgColor = `rgb(${r}, ${g}, ${b})`
          const deepR = Math.max(0, Math.round(r * 0.4))
          const deepG = Math.max(0, Math.round(g * 0.4))
          const deepB = Math.max(0, Math.round(b * 0.4))
          const deepColor = `rgb(${deepR}, ${deepG}, ${deepB})`
          const isLight = 0.299 * r + 0.587 * g + 0.114 * b > 165
          setCoverColor({
            background: `linear-gradient(135deg, ${avgColor} 0%, ${deepColor} 100%)`,
            heroBg: avgColor,
            heroBgDeep: deepColor,
            borderColor: `rgba(${r}, ${g}, ${b}, 0.4)`,
            shadowColor: `rgba(${r}, ${g}, ${b}, 0.25)`,
            isLight,
          })
        } else {
          setCoverColor(null)
        }
      }, 0)
      return () => {
        cancelled = true
        clearTimeout(timer)
      }
    }

    return () => {
      cancelled = true
    }
  }, [currentCoverUrl, currentAccent])

  const heroTheme = coverColor ?? {
    background: 'var(--panel)',
    heroBg: '#151716',
    heroBgDeep: '#0d0f0e',
    borderColor: 'var(--line)',
    shadowColor: 'rgba(0, 0, 0, 0.5)',
    isLight: false,
  }

  function startProgress() {
    stopProgress()
    progressTimer.current = window.setInterval(() => {
      const howl = audioRef.current
      if (!howl) return
      const position = howl.seek()
      setSeek(typeof position === 'number' ? position : 0)
    }, 350)
  }

  function stopProgress() {
    if (progressTimer.current) {
      window.clearInterval(progressTimer.current)
      progressTimer.current = null
    }
  }

  useEffect(() => {
    volumeRef.current = volume
  }, [volume])

  useEffect(() => () => revokeOwnedObjectUrls(), [])

  useEffect(() => {
    const playlistTrackIds = activePlaylistId === libraryId
      ? tracks.map((track) => track.id)
      : activePlaylist?.trackIds ?? []

    if (!playlistTrackIds.length) return

    const currentIdInPlaylist = currentTrackId ? playlistTrackIds.includes(currentTrackId) : false

    if (lastPlaylistIdRef.current !== activePlaylistId) {
      lastPlaylistIdRef.current = activePlaylistId
      if (!currentTrackId || !currentIdInPlaylist) {
        const fallbackTrackId = playlistTrackIds[0]
        queueRef.current.start(playlistTrackIds, fallbackTrackId)
        if (currentTrackId !== fallbackTrackId) setCurrentTrack(fallbackTrackId)
        return
      }
      queueRef.current.start(playlistTrackIds, currentTrackId)
      return
    }

    if (!currentTrackId && queueRef.current.size === 0) {
      queueRef.current.start(playlistTrackIds, playlistTrackIds[0])
    }
  }, [activePlaylist, activePlaylistId, currentTrackId, setCurrentTrack, tracks])

  useEffect(() => {
    audioRef.current?.stop()
    audioRef.current?.unload()
    audioRef.current = null
    if (!currentAudioUrl) return
    const howl = new Howl({
      src: [currentAudioUrl],
      html5: true,
      volume: volumeRef.current,
      onend: () => playNextRef.current(),
      onload: () => setSeek(0),
      onloaderror: () => setIsPlaying(false),
      onplayerror: () => setIsPlaying(false),
    })
    audioRef.current = howl
    setSeek(0)
    return () => {
      howl.stop()
      howl.unload()
      if (audioRef.current === howl) audioRef.current = null
      stopProgress()
    }
  }, [currentAudioUrl, currentId, setIsPlaying])

  useEffect(() => {
    const howl = audioRef.current
    if (!howl) return
    if (isPlaying) {
      if (!howl.playing()) howl.play()
      startProgress()
    } else {
      howl.pause()
      stopProgress()
    }
    return () => stopProgress()
  }, [isPlaying, currentAudioUrl])

  useEffect(() => {
    audioRef.current?.volume(volume)
  }, [volume])

  async function handleMusicFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return

    // If cover files were selected together with music files, add them to the pool
    const coverFiles = files.filter(isCoverFile)
    const storeLookup = useMusicStore.getState().coverLookup
    const combinedLookup = new Map(storeLookup)

    if (coverFiles.length > 0) {
      const { lookup, urls } = extractCovers(coverFiles)
      for (const [k, v] of lookup.entries()) {
        combinedLookup.set(k, v)
      }
      addCovers(lookup, urls)
    }

    const parsedTracks = await tracksFromFiles(files, combinedLookup, new Set(useMusicStore.getState().tracks.map((track) => track.id)))
    if (parsedTracks.length > 0) {
      addTracks(parsedTracks)
    }
    event.target.value = ''
  }

  async function handleMusicFolder(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return

    // If cover files were found inside the music folder (or album subdirectories), add them to the pool
    const coverFiles = files.filter(isCoverFile)
    const storeLookup = useMusicStore.getState().coverLookup
    const combinedLookup = new Map(storeLookup)

    if (coverFiles.length > 0) {
      const { lookup, urls } = extractCovers(coverFiles)
      for (const [k, v] of lookup.entries()) {
        combinedLookup.set(k, v)
      }
      addCovers(lookup, urls)
    }

    const parsedTracks = await tracksFromFiles(files, combinedLookup, new Set(useMusicStore.getState().tracks.map((track) => track.id)))
    if (parsedTracks.length > 0) {
      addTracks(parsedTracks)
    }
    event.target.value = ''
  }

  function handleCoverFolder(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return
    const { lookup, urls } = extractCovers(files)
    if (urls.length > 0) {
      addCovers(lookup, urls)
    }
    event.target.value = ''
  }

  async function handleDrop(event: React.DragEvent) {
    event.preventDefault()
    const files = Array.from(event.dataTransfer?.files ?? [])
    if (files.length === 0) return

    const coverFiles = files.filter(isCoverFile)
    const audioFiles = files.filter(isAudioFile)
    const storeLookup = useMusicStore.getState().coverLookup
    const combinedLookup = new Map(storeLookup)

    if (coverFiles.length > 0) {
      const { lookup, urls } = extractCovers(coverFiles)
      for (const [k, v] of lookup.entries()) {
        combinedLookup.set(k, v)
      }
      addCovers(lookup, urls)
    }

    if (audioFiles.length > 0) {
      const parsedTracks = await tracksFromFiles(audioFiles, combinedLookup, new Set(useMusicStore.getState().tracks.map((track) => track.id)))
      addTracks(parsedTracks)
    }
  }

  function handleCreatePlaylist() {
    const name = newPlaylistName.trim()
    if (!name) return
    createPlaylist(name)
    setNewPlaylistName('')
  }

  function moveTrack(direction: 1 | -1, automatic = false) {
    if (!currentTrackId) return
    const nextId = direction === 1
      ? queueRef.current.next(currentTrackId, shuffle, repeat, automatic)
      : queueRef.current.previous(currentTrackId, shuffle, repeat)
    if (nextId) setCurrentTrack(nextId)
    else setIsPlaying(false)
  }

  function playPrevious() { moveTrack(-1) }
  function playNext(automatic = false) {
    if (automatic && repeat === 'one') {
      audioRef.current?.seek(0)
      audioRef.current?.play()
      startProgress()
      return
    }
    moveTrack(1, automatic)
  }

  function handleTrackPlay(trackId: string) {
    if (currentTrackId === trackId) {
      setIsPlaying(!isPlaying)
    } else {
      queueRef.current.start(visibleTracks.map((track) => track.id), trackId)
      setCurrentTrack(trackId)
    }
  }

  useEffect(() => {
    playNextRef.current = () => playNext(true)
  })

  function togglePlay() {
    if (!currentTrack && visibleTracks[0]) {
      queueRef.current.start(visibleTracks.map((track) => track.id), visibleTracks[0].id)
      setCurrentTrack(visibleTracks[0].id)
      return
    }
    setIsPlaying(!isPlaying)
  }

  function handleSeek(value: number) {
    setSeek(value)
    audioRef.current?.seek(value)
  }

  return (
    <main
      className="app-shell"
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <Sidebar
        activePlaylistId={activePlaylistId}
        playlists={playlists}
        tracks={tracks}
        onSelect={setActivePlaylist}
        onCreate={handleCreatePlaylist}
        onRenamePlaylist={(playlist) => setPlaylistToRename(playlist)}
        onDeletePlaylist={(playlist) => setPlaylistToDelete(playlist)}
        playlistName={newPlaylistName}
        setPlaylistName={setNewPlaylistName}
        onAddSongs={handleMusicFiles}
        onAddMusicFolder={handleMusicFolder}
        onAddCoverFolder={handleCoverFolder}
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
                  onTogglePlay={togglePlay}
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
            <span>
              {visibleTracks.length} {visibleTracks.length === 1 ? 'song' : 'songs'} · {formatTime(visibleTracks.reduce((sum, track) => sum + track.duration, 0))}
            </span>
          </div>
        </section>

        <TrackList
          tracks={visibleTracks}
          playlists={playlists}
          activePlaylistId={activePlaylistId}
          activePlaylist={activePlaylist}
          currentTrackId={currentTrackId}
          isPlaying={isPlaying}
          onPlay={handleTrackPlay}
          onAddToPlaylist={addTrackToPlaylist}
          onRemoveFromPlaylist={removeTrackFromPlaylist}
          onEditTrack={setEditingTrack}
          onAddSongs={handleMusicFiles}
          onAddMusicFolder={handleMusicFolder}
          onAddCoverFolder={handleCoverFolder}
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
        onTogglePlay={togglePlay}
        onPrevious={playPrevious}
        onNext={playNext}
        onSeek={handleSeek}
        onShuffle={toggleShuffle}
        onRepeat={cycleRepeat}
        onVolume={setVolume}
      />

      {editingTrack && (
        <EditTrackModal
          track={editingTrack}
          isPlaying={isPlaying}
          onClose={() => setEditingTrack(null)}
          onSave={(updates) => updateTrack(editingTrack.id, updates)}
        />
      )}

      {playlistToRename && (
        <RenamePlaylistModal
          playlist={playlistToRename}
          onClose={() => setPlaylistToRename(null)}
          onSave={(newName) => renamePlaylist(playlistToRename.id, newName)}
        />
      )}

      {playlistToDelete && (
        <DeletePlaylistModal
          playlist={playlistToDelete}
          onClose={() => setPlaylistToDelete(null)}
          onConfirm={() => deletePlaylist(playlistToDelete.id)}
        />
      )}
    </main>
  )
}

type CdDiscProps = {
  track?: Track
  isPlaying: boolean
  onTogglePlay: () => void
}

function CdDisc({ track, isPlaying, onTogglePlay }: CdDiscProps) {
  return (
    <div
      className="cd-wrapper"
      onClick={onTogglePlay}
      role="button"
      tabIndex={0}
      title={track ? `${isPlaying ? 'Pause' : 'Play'} - ${cleanDisplayTitle(track.title)}` : 'No track loaded'}
      aria-label={track ? `${cleanDisplayTitle(track.title)} CD - ${isPlaying ? 'Pause' : 'Play'}` : 'CD player'}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onTogglePlay()
        }
      }}
    >
      {/* The physical rotating CD disc */}
      <div className={`cd-disc ${isPlaying ? 'is-playing' : 'is-paused'}`}>
        {/* Base reflective substrate */}
        <div className="cd-base" />

        {/* Cover Art Layer with circular CD mask */}
        {track?.coverUrl ? (
          <div className="cd-artwork-layer">
            <img src={track.coverUrl} alt={`${track.title} cover art`} className="cd-artwork-img" />
          </div>
        ) : (
          <div
            className="cd-artwork-layer cd-generated-artwork"
            style={{ '--cover-accent': track?.accent ?? 'var(--lime)' } as CSSProperties}
          >
            <div className="cd-generated-pattern" />
            <div className="cd-generated-content">
              <DiscFilled size={36} className="cd-generated-icon" />
              <strong className="cd-generated-title">{track ? cleanDisplayTitle(track.title) : 'No Track Selected'}</strong>
              <span className="cd-generated-artist">{track?.artist ?? 'Resonance Audio'}</span>
            </div>
          </div>
        )}

        {/* Concentric microgrooves & laser data tracks */}
        <div className="cd-grooves" />

        {/* Iridescent rainbow optical diffraction spectral sheen */}
        <div className="cd-spectral-sheen" />

        {/* Dynamic gloss reflection */}
        <div className="cd-surface-glare" />

        {/* Center Polycarbonate Clamping Hub (Clear plastic ring) */}
        <div className="cd-hub-area">
          <div className="cd-hub-mirror-band" />
          <div className="cd-hub-text">
            <span>COMPACT DISC DIGITAL AUDIO</span>
          </div>
          <div className="cd-hub-inner-ridge" />

          {/* Authentic Center Spindle Hole (hole in the middle) */}
          <div className="cd-center-hole" />
        </div>

        {/* Outer clear polycarbonate rim */}
        <div className="cd-outer-rim" />
      </div>
    </div>
  )
}

type SidebarProps = {
  activePlaylistId: string
  playlists: Playlist[]
  tracks: Track[]
  playlistName: string
  setPlaylistName: (name: string) => void
  onSelect: (playlistId: string) => void
  onCreate: () => void
  onRenamePlaylist: (playlist: Playlist) => void
  onDeletePlaylist: (playlist: Playlist) => void
  onAddSongs: (e: ChangeEvent<HTMLInputElement>) => void
  onAddMusicFolder: (e: ChangeEvent<HTMLInputElement>) => void
  onAddCoverFolder: (e: ChangeEvent<HTMLInputElement>) => void
}

function Sidebar({
  activePlaylistId,
  playlists,
  tracks,
  playlistName,
  setPlaylistName,
  onSelect,
  onCreate,
  onRenamePlaylist,
  onDeletePlaylist,
  onAddSongs,
  onAddMusicFolder,
  onAddCoverFolder,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <AudioLinesFilled size={22} />
        </div>
        <div>
          <strong>Resonance</strong>
          <span>Local library</span>
        </div>
      </div>

      <nav className="nav-stack" aria-label="Music sections">
        <button
          className={activePlaylistId === libraryId ? 'nav-item active' : 'nav-item'}
          type="button"
          onClick={() => onSelect(libraryId)}
        >
          <DiscFilled size={18} />
          <span>All Songs</span>
          <em>{tracks.length}</em>
        </button>
        {playlists.map((playlist) => (
          <div
            key={playlist.id}
            className={`nav-item nav-playlist-item ${activePlaylistId === playlist.id ? 'active' : ''}`}
            onClick={() => onSelect(playlist.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(playlist.id)
              }
            }}
          >
            {playlist.id === favoritesId ? <HeartFilled size={18} /> : <PlaylistFilled size={18} />}
            <span className="nav-playlist-name">{playlist.name}</span>
            <em>{playlist.trackIds.length}</em>
            <div className="nav-item-actions">
              <button
                type="button"
                className="nav-action-btn edit"
                title={`Rename playlist "${playlist.name}"`}
                aria-label={`Rename playlist "${playlist.name}"`}
                onClick={(e) => {
                  e.stopPropagation()
                  onRenamePlaylist(playlist)
                }}
              >
                <PencilFilled size={13} />
              </button>
              <button
                type="button"
                className="nav-action-btn delete"
                title={`Delete playlist "${playlist.name}"`}
                aria-label={`Delete playlist "${playlist.name}"`}
                onClick={(e) => {
                  e.stopPropagation()
                  onDeletePlaylist(playlist)
                }}
              >
                <TrashFilled size={13} />
              </button>
            </div>
          </div>
        ))}
        <form
          className="nav-item playlist-form"
          onSubmit={(event) => {
            event.preventDefault()
            onCreate()
          }}
        >
          <PlaylistFilled size={18} className="playlist-form-icon" />
          <input
            value={playlistName}
            onChange={(event) => setPlaylistName(event.target.value)}
            placeholder="New playlist"
            aria-label="New playlist name"
          />
          <button
            type="submit"
            aria-label="Create playlist"
            className="playlist-add-btn"
            title="Create playlist"
          >
            <PlusFilled size={14} />
          </button>
        </form>

        <label className="nav-item import-nav-item" title="Manually select audio files (current mode)">
          <UploadFilled size={18} />
          <span>Add songs</span>
          <input type="file" accept="audio/*" multiple onChange={onAddSongs} />
        </label>

        <label className="nav-item import-nav-item" title="Import an entire music folder">
          <FolderMusicFilled size={18} />
          <span>Music folder</span>
          <input
            type="file"
            multiple
            onChange={onAddMusicFolder}
            {...{ webkitdirectory: '', directory: '' }}
          />
        </label>

        <label className="nav-item import-nav-item" title="Import a folder of cover artwork">
          <FolderImageFilled size={18} />
          <span>Cover folder</span>
          <input
            type="file"
            multiple
            onChange={onAddCoverFolder}
            {...{ webkitdirectory: '', directory: '' }}
          />
        </label>
      </nav>
    </aside>
  )
}

type TrackListProps = {
  tracks: Track[]
  playlists: Playlist[]
  activePlaylistId: string
  activePlaylist?: Playlist
  currentTrackId?: string
  isPlaying: boolean
  onPlay: (trackId: string) => void
  onAddToPlaylist: (playlistId: string, trackId: string) => void
  onRemoveFromPlaylist: (playlistId: string, trackId: string) => void
  onEditTrack: (track: Track) => void
  onAddSongs?: (e: ChangeEvent<HTMLInputElement>) => void
  onAddMusicFolder?: (e: ChangeEvent<HTMLInputElement>) => void
  onAddCoverFolder?: (e: ChangeEvent<HTMLInputElement>) => void
}

function TrackList({
  tracks,
  playlists,
  activePlaylistId,
  activePlaylist,
  currentTrackId,
  isPlaying,
  onPlay,
  onAddToPlaylist,
  onRemoveFromPlaylist,
  onEditTrack,
  onAddSongs,
  onAddMusicFolder,
  onAddCoverFolder,
}: TrackListProps) {
  if (tracks.length === 0) {
    return (
      <motion.div className="empty-state" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
        <DiscFilled size={42} />
        <h3>Your library is waiting</h3>
        <p>Add songs manually or import an entire music folder. Covers will automatically be applied to songs in your library.</p>
        <div className="empty-state-actions">
          {onAddSongs && (
            <label className="empty-state-btn" title="Manually select audio files">
              <UploadFilled size={15} />
              <span>Add songs</span>
              <input type="file" accept="audio/*" multiple onChange={onAddSongs} />
            </label>
          )}
          {onAddMusicFolder && (
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
          )}
          {onAddCoverFolder && (
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
        {tracks.map((track, index) => (
          <motion.article
            className={currentTrackId === track.id ? 'track-row active' : 'track-row'}
            key={track.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.018, 0.14), duration: 0.22, ease: 'easeOut' }}
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
            <button
              className="track-play"
              type="button"
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
            </button>
            <div className="mini-cover" style={{ '--cover-accent': track.accent } as CSSProperties}>
              {track.coverUrl ? <img src={track.coverUrl} alt="" /> : <DiscFilled size={20} />}
            </div>
            <div className="track-meta">
              <strong>{cleanDisplayTitle(track.title)}</strong>
              <span>{track.artist}</span>
            </div>
            <span className="track-album">{track.album}</span>
            <span className="track-time">{formatTime(track.duration)}</span>
            <PlaylistDropdown
              trackId={track.id}
              trackTitle={cleanDisplayTitle(track.title)}
              playlists={playlists}
              onAddToPlaylist={onAddToPlaylist}
              onRemoveFromPlaylist={onRemoveFromPlaylist}
            />
            <div className="track-row-btns" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="track-edit-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  onEditTrack(track)
                }}
                title={`Rename or edit details for ${cleanDisplayTitle(track.title)}`}
                aria-label={`Edit ${cleanDisplayTitle(track.title)}`}
              >
                <PencilFilled size={15} />
              </button>
              {activePlaylistId !== libraryId && (
                <button
                  type="button"
                  className="track-remove-from-playlist-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemoveFromPlaylist(activePlaylistId, track.id)
                  }}
                  title={`Remove "${cleanDisplayTitle(track.title)}" from ${activePlaylist?.name ?? 'playlist'}`}
                  aria-label={`Remove "${cleanDisplayTitle(track.title)}" from ${activePlaylist?.name ?? 'playlist'}`}
                >
                  <CloseFilled size={15} />
                </button>
              )}
            </div>
          </motion.article>
        ))}
      </motion.div>
    </AnimatePresence>
  )
}

type PlaylistDropdownProps = {
  trackId: string
  trackTitle: string
  playlists: Playlist[]
  onAddToPlaylist: (playlistId: string, trackId: string) => void
  onRemoveFromPlaylist: (playlistId: string, trackId: string) => void
}

function PlaylistDropdown({
  trackId,
  trackTitle,
  playlists,
  onAddToPlaylist,
  onRemoveFromPlaylist,
}: PlaylistDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  function handleToggle(playlist: Playlist) {
    if (playlist.trackIds.includes(trackId)) {
      onRemoveFromPlaylist(playlist.id, trackId)
    } else {
      onAddToPlaylist(playlist.id, trackId)
    }
  }

  return (
    <div className="playlist-dropdown-wrapper" ref={dropdownRef}>
      <button
        type="button"
        className={`playlist-dropdown-trigger ${isOpen ? 'active' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={`Manage playlists for ${trackTitle}`}
      >
        <span>Add to</span>
        <ChevronDownFilled size={14} className={`dropdown-chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && (
        <div className="playlist-menu" role="menu">
          <div className="playlist-menu-header">Add or Remove from Playlist</div>
          {playlists.map((playlist) => {
            const isAlreadyIn = playlist.trackIds.includes(trackId)
            return (
              <button
                key={playlist.id}
                type="button"
                className={`playlist-menu-item ${isAlreadyIn ? 'is-added' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  handleToggle(playlist)
                }}
                role="menuitem"
                title={isAlreadyIn ? `Remove from ${playlist.name}` : `Add to ${playlist.name}`}
              >
                <div className="playlist-item-label">
                  {playlist.id === favoritesId ? (
                    <HeartFilled size={14} className="playlist-icon heart" />
                  ) : (
                    <PlaylistFilled size={14} className="playlist-icon" />
                  )}
                  <span>{playlist.name}</span>
                </div>
                {isAlreadyIn && <CheckFilled size={14} className="playlist-check" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

type PlayerBarProps = {
  currentTrack?: Track
  isPlaying: boolean
  audioRef: React.RefObject<Howl | null>
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

function PlayerBar({
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
  const isDraggingRef = useRef(false)
  const rangeInputRef = useRef<HTMLInputElement>(null)
  const timeLabelRef = useRef<HTMLSpanElement>(null)
  const rafRef = useRef<number | null>(null)

  const duration = currentTrack?.duration ?? 0

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

          if (rangeInputRef.current) {
            rangeInputRef.current.value = String(clampedPos)
            rangeInputRef.current.style.setProperty('--progress-pct', `${pct}%`)
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
    if (rangeInputRef.current && !isDraggingRef.current) {
      const pct = duration > 0 ? (Math.min(seek, duration) / duration) * 100 : 0
      rangeInputRef.current.value = String(seek)
      rangeInputRef.current.style.setProperty('--progress-pct', `${pct}%`)
    }
    if (timeLabelRef.current && !isDraggingRef.current) {
      timeLabelRef.current.textContent = formatTime(seek)
    }
  }, [seek, duration, currentTrack?.id])

  return (
    <footer className="player-bar">
      <div className="player-track">
        <div className="mini-cover large" style={{ '--cover-accent': currentTrack?.accent } as CSSProperties}>
          {currentTrack?.coverUrl ? <img src={currentTrack.coverUrl} alt="" /> : <DiscFilled size={22} />}
        </div>
        <div>
          <strong>{currentTrack ? cleanDisplayTitle(currentTrack.title) : 'No track selected'}</strong>
          <span>{currentTrack?.artist ?? 'Choose a song to start'}</span>
        </div>
      </div>

      <div className="transport">
        <div className="transport-buttons">
          <button className={shuffle ? 'control active' : 'control'} type="button" onClick={onShuffle} aria-label="Toggle shuffle">
            <ShuffleFilled size={18} />
          </button>
          <button className="control" type="button" onClick={onPrevious} aria-label="Previous track">
            <SkipBackFilled size={20} />
          </button>
          <button className="play-button" type="button" onClick={onTogglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <PauseFilled size={24} /> : <PlayFilled size={24} />}
          </button>
          <button className="control" type="button" onClick={onNext} aria-label="Next track">
            <SkipForwardFilled size={20} />
          </button>
          <button className={repeat !== 'off' ? 'control active' : 'control'} type="button" onClick={onRepeat} aria-label="Cycle repeat mode">
            {repeat === 'one' ? <RepeatOneFilled size={18} /> : <RepeatFilled size={18} />}
          </button>
        </div>
        <div className="progress-line">
          <span ref={timeLabelRef}>{formatTime(seek)}</span>
          <input
            ref={rangeInputRef}
            type="range"
            className="frosted-range"
            min="0"
            max={Math.max(duration, 1)}
            step="any"
            defaultValue={seek}
            onPointerDown={() => {
              isDraggingRef.current = true
            }}
            onInput={(event) => {
              const val = Number(event.currentTarget.value)
              const pct = duration > 0 ? (val / duration) * 100 : 0
              if (rangeInputRef.current) {
                rangeInputRef.current.style.setProperty('--progress-pct', `${pct}%`)
              }
              if (timeLabelRef.current) {
                timeLabelRef.current.textContent = formatTime(val)
              }
            }}
            onChange={(event) => {
              const val = Number(event.target.value)
              isDraggingRef.current = false
              onSeek(val)
            }}
            onPointerUp={(event) => {
              isDraggingRef.current = false
              const val = Number(event.currentTarget.value)
              onSeek(val)
            }}
            style={
              {
                '--progress-pct': `${duration > 0 ? (Math.min(seek, duration) / duration) * 100 : 0}%`,
              } as CSSProperties
            }
            aria-label="Playback progress"
          />
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="volume">
        <ElasticSlider value={volume} onChange={onVolume} />
      </div>
    </footer>
  )
}

function getVisibleTracks(
  tracks: Track[],
  activePlaylistId: string,
  activePlaylist: Playlist | undefined,
  query: string,
) {
  const playlistTracks =
    activePlaylistId === libraryId
      ? tracks
      : tracks.filter((track) => activePlaylist?.trackIds.includes(track.id))
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) return playlistTracks

  return playlistTracks.filter((track) =>
    [track.title, track.artist, track.album, track.fileName].some((value) =>
      value.toLowerCase().includes(normalizedQuery),
    ),
  )
}

type EditTrackModalProps = {
  track: Track
  isPlaying: boolean
  onClose: () => void
  onSave: (updates: Partial<Track>) => void
}

function EditTrackModal({ track, isPlaying, onClose, onSave }: EditTrackModalProps) {
  const [title, setTitle] = useState(cleanDisplayTitle(track.title))
  const [artist, setArtist] = useState(track.artist)
  const [album, setAlbum] = useState(track.album)
  const [coverUrl, setCoverUrl] = useState<string | undefined>(track.coverUrl)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      setCoverUrl(dataUrl)
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  function handleRemoveCover() {
    setCoverUrl(undefined)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSave({
      title: title.trim() || track.title,
      artist: artist.trim() || track.artist,
      album: album.trim() || track.album,
      coverUrl,
    })
    onClose()
  }

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-modal-title"
    >
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
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
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save Changes
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}

type DeletePlaylistModalProps = {
  playlist: Playlist
  onClose: () => void
  onConfirm: () => void
}

function DeletePlaylistModal({ playlist, onClose, onConfirm }: DeletePlaylistModalProps) {
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
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-playlist-title"
    >
      <div className="modal-card modal-card-sm" onClick={(e) => e.stopPropagation()}>
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
      </div>
    </div>
  )
}

type RenamePlaylistModalProps = {
  playlist: Playlist
  onClose: () => void
  onSave: (newName: string) => void
}

function RenamePlaylistModal({ playlist, onClose, onSave }: RenamePlaylistModalProps) {
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
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rename-playlist-title"
    >
      <div className="modal-card modal-card-sm" onClick={(e) => e.stopPropagation()}>
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
      </div>
    </div>
  )
}

export default App
