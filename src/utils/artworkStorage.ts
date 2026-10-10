import { BaseDirectory, exists, mkdir, writeFile } from '@tauri-apps/plugin-fs'
import { appDataDir, join } from '@tauri-apps/api/path'
import { isDesktopApp, toNativeAssetUrl } from './platform.ts'
import type { Track } from '../types.ts'

export function sanitizeArtworkFilename(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32)
  let hash = 5381
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) + hash) ^ name.charCodeAt(i)
  }
  return `${base || 'art'}_${(hash >>> 0).toString(16)}`
}

export function extensionForMime(mime?: string): string {
  if (!mime) return 'jpg'
  if (/png/i.test(mime)) return 'png'
  if (/webp/i.test(mime)) return 'webp'
  if (/gif/i.test(mime)) return 'gif'
  return 'jpg'
}

/**
 * Save raw image bytes to the AppData artwork directory durably.
 * Returns the durable absolute filePath, or null.
 */
export async function saveEmbeddedArtwork(
  trackId: string,
  imageBytes: Uint8Array,
  mime?: string,
): Promise<string | null> {
  if (!isDesktopApp()) return null

  try {
    const artworkDirExists = await exists('artwork', { baseDir: BaseDirectory.AppData })
    if (!artworkDirExists) {
      await mkdir('artwork', { baseDir: BaseDirectory.AppData, recursive: true })
    }

    const ext = extensionForMime(mime)
    const fileName = `${sanitizeArtworkFilename(trackId)}.${ext}`
    const relativePath = `artwork/${fileName}`
    await writeFile(relativePath, imageBytes, { baseDir: BaseDirectory.AppData })

    const appData = await appDataDir()
    return await join(appData, 'artwork', fileName)
  } catch (err) {
    console.warn('Failed to save embedded artwork to disk:', err)
    return null
  }
}

/**
 * Save custom artwork to the AppData artwork directory or retain local file path.
 */
export async function saveCustomArtwork(
  trackId: string,
  source: string,
): Promise<string | null> {
  if (!isDesktopApp()) return null

  // If already a local file path on disk, it is already durable
  if (!source.startsWith('data:') && !source.startsWith('blob:')) {
    return source
  }

  // If a data: URL, convert to bytes and save to disk
  if (source.startsWith('data:')) {
    try {
      const match = source.match(/^data:([^;]+);base64,(.+)$/)
      if (!match) return null

      const mime = match[1]
      const base64 = match[2]
      const binaryString = atob(base64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      const artworkDirExists = await exists('artwork', { baseDir: BaseDirectory.AppData })
      if (!artworkDirExists) {
        await mkdir('artwork', { baseDir: BaseDirectory.AppData, recursive: true })
      }

      const ext = extensionForMime(mime)
      const fileName = `custom_${sanitizeArtworkFilename(trackId)}.${ext}`
      const relativePath = `artwork/${fileName}`
      await writeFile(relativePath, bytes, { baseDir: BaseDirectory.AppData })

      const appData = await appDataDir()
      return await join(appData, 'artwork', fileName)
    } catch (err) {
      console.warn('Failed to save custom artwork data URL to disk:', err)
      return null
    }
  }

  // If a blob: URL, fetch bytes and save to disk
  if (source.startsWith('blob:')) {
    try {
      const response = await fetch(source)
      const blob = await response.blob()
      const arrayBuffer = await blob.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)

      const artworkDirExists = await exists('artwork', { baseDir: BaseDirectory.AppData })
      if (!artworkDirExists) {
        await mkdir('artwork', { baseDir: BaseDirectory.AppData, recursive: true })
      }

      const ext = extensionForMime(blob.type)
      const fileName = `custom_${sanitizeArtworkFilename(trackId)}.${ext}`
      const relativePath = `artwork/${fileName}`
      await writeFile(relativePath, bytes, { baseDir: BaseDirectory.AppData })

      const appData = await appDataDir()
      return await join(appData, 'artwork', fileName)
    } catch (err) {
      console.warn('Failed to save custom artwork blob to disk:', err)
      return null
    }
  }

  return null
}

/**
 * Strips temporary in-memory URLs from tracks before saving to storage.
 * Preserves durable file path references and any explicitly selected custom artwork location.
 */
export function sanitizeTrackForPersistence(track: Track): Track {
  const isTemporaryUrl = (value?: string) =>
    Boolean(value && (value.startsWith('blob:') || value.startsWith('data:')))

  const nextAudioUrl = isTemporaryUrl(track.audioUrl) ? undefined : track.audioUrl
  const nextCoverUrl = isTemporaryUrl(track.coverUrl) ? undefined : track.coverUrl

  return {
    ...track,
    audioUrl: nextAudioUrl,
    coverUrl: nextCoverUrl,
  }
}

export function sanitizeTracksForPersistence(tracks: Track[]): Track[] {
  return tracks.map(sanitizeTrackForPersistence)
}

/**
 * Hydrates artwork on track load:
 * Rebuilds durable URLs from file paths and removes transient blob/data URLs.
 */
export function hydrateTrackArtwork(track: Track): Track {
  let coverUrl = track.coverUrl
  let audioUrl = track.audioUrl

  if (coverUrl && (coverUrl.startsWith('blob:') || coverUrl.startsWith('data:'))) {
    coverUrl = undefined
  }

  if (audioUrl && (audioUrl.startsWith('blob:') || audioUrl.startsWith('data:'))) {
    audioUrl = undefined
  }

  if (track.coverPath) {
    coverUrl = toNativeAssetUrl(track.coverPath)
  }

  if (track.filePath) {
    audioUrl = toNativeAssetUrl(track.filePath)
  }

  return {
    ...track,
    audioUrl,
    coverUrl,
  }
}

export function hydrateTracksArtwork(tracks: Track[]): Track[] {
  return tracks.map(hydrateTrackArtwork)
}
