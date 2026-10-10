import { BaseDirectory, exists, mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { isDesktopApp } from './platform.ts'
import { hydrateTracksArtwork, sanitizeTracksForPersistence } from './artworkStorage.ts'
import type { Playlist, RepeatMode, ThemeMode, Track } from '../types.ts'

export interface DesktopLibraryPayload {
  tracks: Track[]
  playlists: Playlist[]
  activePlaylistId: string
  currentTrackId?: string
  volume: number
  shuffle: boolean
  repeat: RepeatMode
  themeMode?: ThemeMode
  musicFolderPath?: string
  coverFolderPath?: string
  musicFolderName?: string
  coverFolderName?: string
}

const STORAGE_FILE = 'resonance_library.json'
const WEB_STORAGE_KEY = 'resonance_desktop_library_backup'

export async function saveDesktopLibrary(data: DesktopLibraryPayload): Promise<void> {
  const payload: DesktopLibraryPayload = {
    ...data,
    tracks: sanitizeTracksForPersistence(data.tracks),
  }

  const json = JSON.stringify(payload, null, 2)

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(WEB_STORAGE_KEY, json)
    }
  } catch {
    // ignore
  }

  if (isDesktopApp()) {
    try {
      try {
        const appDataExists = await exists('.', { baseDir: BaseDirectory.AppData })
        if (!appDataExists) {
          await mkdir('.', { baseDir: BaseDirectory.AppData, recursive: true })
        }
      } catch {
        // Directory may already exist or root check may not be needed before writeTextFile
      }
      await writeTextFile(STORAGE_FILE, json, { baseDir: BaseDirectory.AppData })
    } catch (err) {
      console.warn('Failed to save native library to AppData:', err)
    }
  }
}

export async function loadDesktopLibrary(): Promise<DesktopLibraryPayload | null> {
  if (isDesktopApp()) {
    try {
      const fileExists = await exists(STORAGE_FILE, { baseDir: BaseDirectory.AppData })
      if (fileExists) {
        const content = await readTextFile(STORAGE_FILE, { baseDir: BaseDirectory.AppData })
        if (content) {
          const parsed: DesktopLibraryPayload = JSON.parse(content)
          const hydratedTracks = hydrateTracksArtwork(parsed.tracks)

          return {
            ...parsed,
            tracks: hydratedTracks,
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load native library from AppData:', err)
    }
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(WEB_STORAGE_KEY)
      if (raw) {
        const parsed: DesktopLibraryPayload = JSON.parse(raw)
        return {
          ...parsed,
          tracks: hydrateTracksArtwork(parsed.tracks),
        }
      }
    }
  } catch {
    // ignore
  }
  return null
}
