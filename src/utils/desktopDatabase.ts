import { BaseDirectory, exists, mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { isDesktopApp } from './platform.ts'
import { hydrateTracksArtwork, sanitizeTracksForPersistence } from './artworkStorage.ts'
import type { Playlist, RepeatMode, ThemeMode, Track } from '../types.ts'

export interface DesktopLibraryPayload {
  version?: number
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
const STORAGE_VERSION = 2

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function normalizeNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeTracks(value: unknown): Track[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Track => isObject(item) && typeof item.id === 'string')
}

function normalizePlaylists(value: unknown): Playlist[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Playlist => {
    return isObject(item) && typeof item.id === 'string' && typeof item.name === 'string'
  })
}

function normalizeTheme(value: unknown): ThemeMode | undefined {
  return value === 'ambient' || value === 'normal' ? value : undefined
}

function normalizeRepeat(value: unknown): RepeatMode {
  return value === 'one' || value === 'all' ? value : 'off'
}

export function migrateDesktopLibraryPayload(raw: unknown): DesktopLibraryPayload | null {
  if (!isObject(raw)) return null

  const tracks = normalizeTracks(raw.tracks)
  const playlists = normalizePlaylists(raw.playlists)
  const activePlaylistId = normalizeString(raw.activePlaylistId) ?? 'library'
  const currentTrackId = normalizeString(raw.currentTrackId)
  const volume = Math.min(1, Math.max(0, normalizeNumber(raw.volume, 0.82)))
  const shuffle = normalizeBoolean(raw.shuffle, false)
  const repeat = normalizeRepeat(raw.repeat)
  const themeMode = normalizeTheme(raw.themeMode)

  const payload: DesktopLibraryPayload = {
    version: STORAGE_VERSION,
    tracks: hydrateTracksArtwork(sanitizeTracksForPersistence(tracks)),
    playlists,
    activePlaylistId,
    currentTrackId,
    volume,
    shuffle,
    repeat,
    themeMode,
    musicFolderPath: normalizeString(raw.musicFolderPath),
    coverFolderPath: normalizeString(raw.coverFolderPath),
    musicFolderName: normalizeString(raw.musicFolderName),
    coverFolderName: normalizeString(raw.coverFolderName),
  }

  return payload
}

function safeReadJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function saveDesktopLibrary(data: DesktopLibraryPayload): Promise<void> {
  const payload: DesktopLibraryPayload = {
    ...data,
    version: STORAGE_VERSION,
    tracks: sanitizeTracksForPersistence(Array.isArray(data.tracks) ? data.tracks : []),
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
          const parsed = migrateDesktopLibraryPayload(safeReadJson(content))
          if (parsed) return parsed
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
        const parsed = migrateDesktopLibraryPayload(safeReadJson(raw))
        if (parsed) return parsed
      }
    }
  } catch {
    // ignore
  }
  return null
}
