import { useEffect, useRef, useState } from 'react'
import { libraryId, useMusicStore } from '../store/useMusicStore.ts'
import { showToast } from '../store/useToastStore.ts'
import { PlaybackQueue } from '../utils/queue.ts'
import type { Playlist } from '../types.ts'

export interface PlaylistQueueSyncState {
  lastPlaylistId: string | null
  lastTrackIds: string[]
}

export function syncPlaylistQueue(
  queue: PlaybackQueue,
  syncState: PlaylistQueueSyncState,
  params: {
    activePlaylistId: string
    playlistTrackIds: string[]
    currentTrackId?: string
    isPlaying?: boolean
    onTrackSelect?: (trackId: string) => void
  },
): void {
  const { activePlaylistId, playlistTrackIds, currentTrackId, isPlaying, onTrackSelect } = params

  if (!playlistTrackIds.length) {
    syncState.lastPlaylistId = activePlaylistId
    syncState.lastTrackIds = []
    if (!isPlaying) {
      queue.clear()
    }
    return
  }

  const currentIdInPlaylist = currentTrackId
    ? playlistTrackIds.includes(currentTrackId)
    : false

  const playlistChanged = syncState.lastPlaylistId !== activePlaylistId
  const tracksChanged =
    syncState.lastTrackIds.length !== playlistTrackIds.length ||
    syncState.lastTrackIds.some((id, idx) => id !== playlistTrackIds[idx])

  if (playlistChanged) {
    syncState.lastPlaylistId = activePlaylistId
    syncState.lastTrackIds = playlistTrackIds

    // When actively listening, NEVER auto-switch or interrupt playback
    if (isPlaying) {
      if (currentTrackId && currentIdInPlaylist) {
        queue.start(playlistTrackIds, currentTrackId)
      }
      return
    }

    const targetId = currentTrackId || playlistTrackIds[0]
    if (playlistTrackIds.includes(targetId)) {
      queue.start(playlistTrackIds, targetId)
    } else if (playlistTrackIds[0]) {
      queue.start(playlistTrackIds, playlistTrackIds[0])
    }
    if (!currentTrackId && targetId && onTrackSelect) {
      onTrackSelect(targetId)
    }
    return
  }

  if (queue.size === 0) {
    syncState.lastTrackIds = playlistTrackIds
    const targetId = currentTrackId && currentIdInPlaylist ? currentTrackId : (currentTrackId || playlistTrackIds[0])
    queue.start(playlistTrackIds, targetId)
    if (!currentTrackId && targetId && onTrackSelect) {
      onTrackSelect(targetId)
    }
    return
  }

  if (tracksChanged) {
    syncState.lastTrackIds = playlistTrackIds
    queue.sync(playlistTrackIds, currentTrackId)
  }
}

export function usePlaylistManager() {
  const queueRef = useRef(new PlaybackQueue())
  const syncStateRef = useRef<PlaylistQueueSyncState>({
    lastPlaylistId: null,
    lastTrackIds: [],
  })

  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [playlistToDelete, setPlaylistToDelete] = useState<Playlist | null>(null)
  const [playlistToRename, setPlaylistToRename] = useState<Playlist | null>(null)

  const {
    tracks,
    playlists,
    activePlaylistId,
    currentTrackId,
    isPlaying,
    createPlaylist,
    deletePlaylist,
    renamePlaylist,
    setCurrentTrack,
  } = useMusicStore()

  const activePlaylist = playlists.find((playlist) => playlist.id === activePlaylistId)

  useEffect(() => {
    const playlistTrackIds =
      activePlaylistId === libraryId
        ? tracks.map((track) => track.id)
        : activePlaylist?.trackIds ?? []

    syncPlaylistQueue(queueRef.current, syncStateRef.current, {
      activePlaylistId,
      playlistTrackIds,
      currentTrackId,
      isPlaying,
      onTrackSelect: setCurrentTrack,
    })
  }, [activePlaylist, activePlaylistId, currentTrackId, isPlaying, setCurrentTrack, tracks])

  function handleCreatePlaylist() {
    const name = newPlaylistName.trim()
    if (!name) return
    createPlaylist(name)
    showToast(`Created playlist "${name}"`, { title: 'Playlist Created', type: 'success' })
    setNewPlaylistName('')
  }

  function handleConfirmDelete() {
    if (playlistToDelete) {
      deletePlaylist(playlistToDelete.id)
      showToast(`Deleted playlist "${playlistToDelete.name}"`, { title: 'Playlist Deleted', type: 'info' })
      setPlaylistToDelete(null)
    }
  }

  function handleConfirmRename(newName: string) {
    if (playlistToRename) {
      renamePlaylist(playlistToRename.id, newName)
      showToast(`Renamed playlist to "${newName}"`, { title: 'Playlist Renamed', type: 'success' })
      setPlaylistToRename(null)
    }
  }

  return {
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
  }
}
