import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Playlist, RepeatMode, ThemeMode, Track } from '../types.ts'
import { assignCoversToTracks, syncTracksWithCovers, uniqueTracks } from '../utils/library.ts'
import { loadDesktopLibrary, saveDesktopLibrary } from '../utils/desktopDatabase.ts'
import { hydrateTracksArtwork, sanitizeTracksForPersistence } from '../utils/artworkStorage.ts'

type MusicState = {
  tracks: Track[]
  playlists: Playlist[]
  coverPool: string[]
  coverLookup: Map<string, string>
  activePlaylistId: string
  currentTrackId?: string
  isPlaying: boolean
  shuffle: boolean
  repeat: RepeatMode
  themeMode: ThemeMode
  volume: number
  musicFolderPath?: string
  coverFolderPath?: string
  musicFolderName?: string
  coverFolderName?: string
  isInitialized: boolean
  setMusicFolder: (path?: string, name?: string) => void
  setCoverFolder: (path?: string, name?: string) => void
  initDesktopStorage: () => Promise<void>
  addTracks: (tracks: Track[]) => void
  addCovers: (covers: Map<string, string>, extraUrls?: string[]) => void
  createPlaylist: (name: string) => void
  deletePlaylist: (playlistId: string) => void
  renamePlaylist: (playlistId: string, name: string) => void
  addTrackToPlaylist: (playlistId: string, trackId: string) => void
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void
  setActivePlaylist: (playlistId: string) => void
  setCurrentTrack: (trackId: string) => void
  setIsPlaying: (isPlaying: boolean) => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  setThemeMode: (themeMode: ThemeMode) => void
  setVolume: (volume: number) => void
  updateTrack: (trackId: string, updates: Partial<Track>) => void
}

export const libraryId = 'library'
export const favoritesId = 'favorites'

let saveTimer: ReturnType<typeof setTimeout> | null = null
let initPromise: Promise<void> | null = null

function queueSave(state: MusicState) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveDesktopLibrary({
      tracks: state.tracks.filter((t) => Boolean(t.filePath)),
      playlists: state.playlists,
      activePlaylistId: state.activePlaylistId,
      currentTrackId: state.currentTrackId,
      volume: state.volume,
      shuffle: state.shuffle,
      repeat: state.repeat,
      themeMode: state.themeMode,
      musicFolderPath: state.musicFolderPath,
      coverFolderPath: state.coverFolderPath,
      musicFolderName: state.musicFolderName,
      coverFolderName: state.coverFolderName,
    })
  }, 400)
}

export const useMusicStore = create<MusicState>()(
  persist(
    (set, get) => ({
      tracks: [],
      playlists: [
        {
          id: favoritesId,
          name: 'Favorites',
          trackIds: [],
          createdAt: Date.now(),
        },
        {
          id: 'night-drive',
          name: 'Night Drive',
          trackIds: [],
          createdAt: Date.now() + 1,
        },
      ],
      coverPool: [],
      coverLookup: new Map<string, string>(),
      activePlaylistId: libraryId,
      isPlaying: false,
      shuffle: false,
      repeat: 'off',
      themeMode: 'ambient',
      volume: 0.82,
      musicFolderPath: undefined,
      coverFolderPath: undefined,
      musicFolderName: undefined,
      coverFolderName: undefined,
      isInitialized: false,

      setMusicFolder: (path, name) =>
        set((state) => {
          const next = {
            musicFolderPath: path !== undefined ? path : state.musicFolderPath,
            musicFolderName: name !== undefined ? name : state.musicFolderName,
          }
          queueSave({ ...state, ...next })
          return next
        }),

      setCoverFolder: (path, name) =>
        set((state) => {
          const next = {
            coverFolderPath: path !== undefined ? path : state.coverFolderPath,
            coverFolderName: name !== undefined ? name : state.coverFolderName,
          }
          queueSave({ ...state, ...next })
          return next
        }),

      initDesktopStorage: async () => {
        if (get().isInitialized) return
        if (initPromise) return initPromise

        initPromise = (async () => {
          try {
            const loaded = await loadDesktopLibrary()
            if (loaded) {
              set((state) => {
                // 1. Safely merge tracks: loaded tracks + any tracks concurrently added to state
                const trackMap = new Map<string, Track>()
                for (const t of loaded.tracks) {
                  trackMap.set(t.id, t)
                }
                for (const t of state.tracks) {
                  const existing = trackMap.get(t.id)
                  if (existing) {
                    trackMap.set(t.id, { ...existing, ...t })
                  } else {
                    trackMap.set(t.id, t)
                  }
                }
                const mergedTracks = Array.from(trackMap.values())

                // 2. Safely merge playlists: loaded playlists + any playlists concurrently created/updated
                const playlistMap = new Map<string, Playlist>()
                for (const p of loaded.playlists) {
                  playlistMap.set(p.id, p)
                }
                for (const p of state.playlists) {
                  const existing = playlistMap.get(p.id)
                  if (existing) {
                    const mergedTrackIds = Array.from(new Set([...existing.trackIds, ...p.trackIds]))
                    playlistMap.set(p.id, { ...existing, ...p, trackIds: mergedTrackIds })
                  } else {
                    playlistMap.set(p.id, p)
                  }
                }
                const mergedPlaylists = Array.from(playlistMap.values())

                const activePlaylistId =
                  state.activePlaylistId !== libraryId && state.activePlaylistId
                    ? state.activePlaylistId
                    : loaded.activePlaylistId || state.activePlaylistId

                const currentTrackId =
                  state.currentTrackId || loaded.currentTrackId || mergedTracks[0]?.id

                const nextState = {
                  tracks: mergedTracks,
                  playlists: mergedPlaylists,
                  activePlaylistId,
                  currentTrackId,
                  volume: typeof loaded.volume === 'number' ? loaded.volume : state.volume,
                  shuffle: typeof loaded.shuffle === 'boolean' ? loaded.shuffle : state.shuffle,
                  repeat: loaded.repeat || state.repeat,
                  themeMode: loaded.themeMode || state.themeMode,
                  musicFolderPath: state.musicFolderPath || loaded.musicFolderPath,
                  coverFolderPath: state.coverFolderPath || loaded.coverFolderPath,
                  musicFolderName: state.musicFolderName || loaded.musicFolderName,
                  coverFolderName: state.coverFolderName || loaded.coverFolderName,
                  isInitialized: true,
                }

                // If tracks or playlists were added concurrently while loading from disk,
                // queue a save so disk storage reflects the merged state.
                if (state.tracks.length > 0 || state.playlists.length > loaded.playlists.length) {
                  queueSave({ ...state, ...nextState })
                }

                return nextState
              })
              return
            }
          } catch (err) {
            console.warn('Could not initialize desktop storage:', err)
          } finally {
            initPromise = null
          }

          set((state) => ({
            tracks: hydrateTracksArtwork(state.tracks),
            isInitialized: true,
          }))
        })()

        return initPromise
      },

      addTracks: (incoming) =>
        set((state) => {
          const processedIncoming = assignCoversToTracks(
            state.tracks,
            uniqueTracks(state.tracks, incoming),
            state.coverPool,
            state.coverLookup,
          )
          const tracks = [...state.tracks, ...processedIncoming]
          const next = {
            tracks,
            currentTrackId: state.currentTrackId ?? tracks[0]?.id,
          }
          queueSave({ ...state, ...next })
          return next
        }),

      addCovers: (covers, extraUrls = []) =>
        set((state) => {
          const mergedLookup = new Map(state.coverLookup)
          for (const [key, value] of covers.entries()) {
            mergedLookup.set(key, value)
          }
          const incomingCovers = Array.from(new Set([...Array.from(covers.values()), ...extraUrls]))
          const updatedPool = Array.from(new Set([...state.coverPool, ...incomingCovers]))
          const tracks = syncTracksWithCovers(state.tracks, mergedLookup, updatedPool)
          const next = {
            coverLookup: mergedLookup,
            coverPool: updatedPool,
            tracks,
          }
          queueSave({ ...state, ...next })
          return next
        }),

      createPlaylist: (name) =>
        set((state) => {
          const playlists = [
            ...state.playlists,
            {
              id: crypto.randomUUID(),
              name,
              trackIds: [],
              createdAt: Date.now(),
            },
          ]
          queueSave({ ...state, playlists })
          return { playlists }
        }),

      deletePlaylist: (playlistId) =>
        set((state) => {
          const playlists = state.playlists.filter((playlist) => playlist.id !== playlistId)
          const activePlaylistId =
            state.activePlaylistId === playlistId ? libraryId : state.activePlaylistId
          queueSave({ ...state, playlists, activePlaylistId })
          return { playlists, activePlaylistId }
        }),

      renamePlaylist: (playlistId, name) =>
        set((state) => {
          const playlists = state.playlists.map((playlist) =>
            playlist.id === playlistId
              ? { ...playlist, name: name.trim() || playlist.name }
              : playlist,
          )
          queueSave({ ...state, playlists })
          return { playlists }
        }),

      addTrackToPlaylist: (playlistId, trackId) =>
        set((state) => {
          const playlists = state.playlists.map((playlist) =>
            playlist.id === playlistId && !playlist.trackIds.includes(trackId)
              ? { ...playlist, trackIds: [...playlist.trackIds, trackId] }
              : playlist,
          )
          queueSave({ ...state, playlists })
          return { playlists }
        }),

      removeTrackFromPlaylist: (playlistId, trackId) =>
        set((state) => {
          const playlists = state.playlists.map((playlist) =>
            playlist.id === playlistId
              ? { ...playlist, trackIds: playlist.trackIds.filter((id) => id !== trackId) }
              : playlist,
          )
          queueSave({ ...state, playlists })
          return { playlists }
        }),

      setActivePlaylist: (activePlaylistId) => {
        set({ activePlaylistId })
        queueSave(get())
      },

      setCurrentTrack: (currentTrackId) => {
        set({ currentTrackId, isPlaying: true })
        queueSave(get())
      },

      setIsPlaying: (isPlaying) => set({ isPlaying }),

      toggleShuffle: () =>
        set((state) => {
          const shuffle = !state.shuffle
          queueSave({ ...state, shuffle })
          return { shuffle }
        }),

      cycleRepeat: () =>
        set((state) => {
          const repeat =
            state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off'
          queueSave({ ...state, repeat })
          return { repeat }
        }),

      setThemeMode: (themeMode) => {
        set({ themeMode })
        queueSave(get())
      },

      setVolume: (volume) => {
        set({ volume })
        queueSave(get())
      },

      updateTrack: (trackId, updates) =>
        set((state) => {
          const tracks = state.tracks.map((track) =>
            track.id === trackId
              ? {
                  ...track,
                  ...updates,
                  coverPath:
                    updates.coverUrl === undefined && 'coverUrl' in updates
                      ? undefined
                      : updates.coverPath !== undefined
                        ? updates.coverPath
                        : track.coverPath,
                  coverSource:
                    updates.coverUrl !== undefined
                      ? updates.coverSource || (updates.coverUrl ? 'custom' : undefined)
                      : track.coverSource,
                }
              : track,
          )
          queueSave({ ...state, tracks })
          return { tracks }
        }),
    }),
    {
      name: 'resonance-playlists-v1',
      version: 1,
      // Persist playlists, settings, and native persistent tracks
      partialize: (state) => ({
        tracks: sanitizeTracksForPersistence(
          state.tracks.filter((track) => Boolean(track.filePath)),
        ),
        playlists: state.playlists,
        activePlaylistId: state.activePlaylistId,
        volume: state.volume,
        shuffle: state.shuffle,
        repeat: state.repeat,
        themeMode: state.themeMode,
        musicFolderPath: state.musicFolderPath,
        coverFolderPath: state.coverFolderPath,
        musicFolderName: state.musicFolderName,
        coverFolderName: state.coverFolderName,
      }),
    },
  ),
)
