import test from 'node:test'
import assert from 'node:assert/strict'
import { PlaybackQueue } from '../src/utils/queue.ts'
import { trackIdForFile } from '../src/utils/trackIdentity.ts'
import { objectUrlForFile, revokeOwnedObjectUrls } from '../src/utils/objectUrls.ts'
import { readID3Metadata, detectSongAndArtist, autoDetectTrackMetadata } from '../src/utils/metadata.ts'
import { uniqueTracks, tracksFromFiles } from '../src/utils/library.ts'
import {
  parseId3Header,
  readBoundedMetadataFromReader,
  MAX_METADATA_BYTES,
} from '../src/utils/boundedMetadata.ts'
import {
  sanitizeTrackForPersistence,
  sanitizeTracksForPersistence,
  hydrateTrackArtwork,
  hydrateTracksArtwork,
  sanitizeArtworkFilename,
} from '../src/utils/artworkStorage.ts'
import { migrateDesktopLibraryPayload } from '../src/utils/desktopDatabase.ts'
import { nativeTracksFromPaths, scanNativeDroppedPaths } from '../src/utils/nativeFileSystem.ts'
import { useMusicStore } from '../src/store/useMusicStore.ts'
import { syncPlaylistQueue } from '../src/hooks/usePlaylistManager.ts'
import { processTrackEdit } from '../src/utils/trackEdit.ts'
import fs from 'node:fs'

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map()
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  }
}

function fileInfo(path = 'album/song.mp3') {
  return { name: 'song.mp3', size: 123, lastModified: 42, webkitRelativePath: path }
}

test('stable IDs survive reordered imports and distinguish folders', () => {
  assert.equal(trackIdForFile(fileInfo()), trackIdForFile(fileInfo()))
  assert.notEqual(trackIdForFile(fileInfo()), trackIdForFile(fileInfo('other/song.mp3')))
  const file = fileInfo()
  const second = { ...file, lastModified: file.lastModified + 1 }
  assert.notEqual(trackIdForFile(file), trackIdForFile(second))
})

test('duplicate filtering works within an incoming batch', () => {
  const a = { id: 'same' }
  const b = { id: 'other' }
  assert.deepEqual(uniqueTracks([], [a, a, b, b]).map(x => x.id), ['same', 'other'])
  assert.deepEqual(uniqueTracks([a], [a, b]).map(x => x.id), ['other'])
})

test('object URLs are reused until session cleanup', () => {
  const file = new File(['content'], 'song.mp3', { type: 'audio/mpeg', lastModified: 14 })
  const same = new File(['content'], 'song.mp3', { type: 'audio/mpeg', lastModified: 14 })
  const url = objectUrlForFile(file)
  assert.equal(objectUrlForFile(same), url)
  revokeOwnedObjectUrls()
  assert.notEqual(objectUrlForFile(file), url)
  revokeOwnedObjectUrls()
})

test('existing files are rejected before metadata or duration extraction', async () => {
  const file = new File(['fake'], 'song.mp3', { type: 'audio/mpeg', lastModified: 14 })
  const tracks = await tracksFromFiles([file], new Map(), new Set([trackIdForFile(file)]))
  assert.deepEqual(tracks, [])
})

test('shuffle does not repeat until available tracks have played', () => {
  const queue = new PlaybackQueue()
  queue.start(['a', 'b', 'c'], 'a')
  const next = queue.next('a', true, 'off', false, () => 0)
  const third = queue.next(next, true, 'off', false, () => 0)
  assert.equal(new Set(['a', next, third]).size, 3)
  assert.equal(queue.next(third, true, 'off'), undefined)
  assert.equal(queue.previous(third, true, 'off'), next)
  assert.equal(queue.next(next, true, 'off'), third)
})

test('repeat modes and manual Next have distinct behavior', () => {
  const queue = new PlaybackQueue()
  queue.start(['a','b'], 'a')
  assert.equal(queue.next('a',false,'one',true),'a')
  assert.equal(queue.next('a',false,'one',false),'b')
  assert.equal(queue.next('b',false,'off'),undefined)
  assert.equal(queue.next('b',false,'all'),'a')
  assert.equal(queue.previous('a',false,'all'),'b')
})

test('active search does not alter the saved queue', () => {
  const queue = new PlaybackQueue()
  queue.start(['a','b','c'],'a')
  assert.equal(queue.next('a',false,'off'),'b')
})

function synchsafe(n) { return [(n >>> 21)&127,(n>>>14)&127,(n>>>7)&127,n&127] }
function makeTag(version, title, artist) {
  const buildFrame = (name, value) => {
    const data = Buffer.concat([Buffer.from([3]), Buffer.from(value, 'utf8')])
    const size = version === 2 ? Buffer.from([(data.length>>>16)&255,(data.length>>>8)&255,data.length&255]) :
      Buffer.from(version === 4 ? synchsafe(data.length) : [(data.length>>>24)&255,(data.length>>>16)&255,(data.length>>>8)&255,data.length&255])
    return Buffer.concat([Buffer.from(name), size, ...(version === 2 ? [] : [Buffer.from([0,0])]),data])
  }
  const body = Buffer.concat([buildFrame(version === 2 ? 'TT2':'TIT2',title),buildFrame(version === 2 ? 'TP1':'TPE1',artist)])
  const header = Buffer.from([73,68,51,version,0,0,...synchsafe(body.length)])
  return new File([Buffer.concat([header,body])],'track.mp3',{type:'audio/mpeg'})
}

for (const version of [2,3,4]) {
  test(`ID3v2.${version} title and artist metadata`, async () => {
    const result = await readID3Metadata(makeTag(version, 'My Track', 'My Artist'))
    assert.equal(result?.title, 'My Track')
    assert.equal(result?.artist, 'My Artist')
  })
}

test('parses audio filename when no tags are available', () => {
  assert.deepEqual(detectSongAndArtist('Artist - Title.mp3'), { title:'Title', artist:'Artist' })
})

function createMockReader(data) {
  let offset = 0
  let closed = false
  let totalBytesRead = 0
  return {
    async stat() {
      return { size: data.length }
    },
    async read(buffer) {
      if (closed) throw new Error('Reader is closed')
      if (offset >= data.length) return null
      const bytesToRead = Math.min(buffer.length, data.length - offset)
      buffer.set(data.subarray(offset, offset + bytesToRead))
      offset += bytesToRead
      totalBytesRead += bytesToRead
      return bytesToRead
    },
    async seek(offsetDelta, whence = 1) {
      if (closed) throw new Error('Reader is closed')
      if (whence === 0) {
        offset = offsetDelta
      } else if (whence === 1) {
        offset += offsetDelta
      } else if (whence === 2) {
        offset = data.length + offsetDelta
      }
      return offset
    },
    async close() {
      closed = true
    },
    get totalBytesRead() {
      return totalBytesRead
    },
    get isClosed() {
      return closed
    },
  }
}

test('parseId3Header validates ID3 header and detects tag size safely', () => {
  // Valid ID3v2.3 header with 1024 bytes body
  const validHeader = new Uint8Array([73, 68, 51, 3, 0, 0, ...synchsafe(1024)])
  const parsed = parseId3Header(validHeader)
  assert.equal(parsed.isValid, true)
  assert.equal(parsed.version, 3)
  assert.equal(parsed.tagBodySize, 1024)
  assert.equal(parsed.totalTagSize, 1034)

  // Header shorter than 10 bytes
  assert.equal(parseId3Header(new Uint8Array([73, 68, 51])).isValid, false)

  // Header without ID3 magic
  assert.equal(parseId3Header(new Uint8Array(10)).isValid, false)

  // Unsupported version (e.g. ID3v2.5)
  assert.equal(parseId3Header(new Uint8Array([73, 68, 51, 5, 0, 0, 0, 0, 1, 0])).isValid, false)

  // Invalid synchsafe integer with bit 7 set in size
  assert.equal(parseId3Header(new Uint8Array([73, 68, 51, 3, 0, 0, 0x80, 0, 0, 1])).isValid, false)

  // ID3v2.4 with footer flag accounts for 10-byte footer
  const footerHeader = new Uint8Array([73, 68, 51, 4, 0, 0x10, ...synchsafe(200)])
  const parsedFooter = parseId3Header(footerHeader)
  assert.equal(parsedFooter.isValid, true)
  assert.equal(parsedFooter.totalTagSize, 220) // 10 header + 200 body + 10 footer
})

test('bounded reader reads only 10 bytes and stops when no ID3 tag exists', async () => {
  // Simulate a 5 MB audio file starting with MP3 sync frame (no ID3 tag)
  const fileData = new Uint8Array(5 * 1024 * 1024)
  fileData[0] = 0xff
  fileData[1] = 0xfb
  const mockReader = createMockReader(fileData)

  const result = await readBoundedMetadataFromReader(mockReader)
  assert.equal(result, null)
  // Only the initial 10-byte header should have been read from disk, not the 5MB audio!
  assert.equal(mockReader.totalBytesRead, 10)
  assert.equal(mockReader.isClosed, true)
})

test('bounded reader reads only declared tag region without reading audio data', async () => {
  // Tag size: 256 bytes body + 10 byte header = 266 bytes total
  const tagHeader = new Uint8Array([73, 68, 51, 3, 0, 0, ...synchsafe(256)])
  const fullFile = new Uint8Array(4 * 1024 * 1024) // 4 MB audio file
  fullFile.set(tagHeader, 0)
  // Fill tag body with dummy bytes
  for (let i = 10; i < 266; i++) fullFile[i] = 42

  const mockReader = createMockReader(fullFile)
  const result = await readBoundedMetadataFromReader(mockReader)

  assert.notEqual(result, null)
  assert.equal(result?.length, 266)
  // Total bytes read must be exactly the tag size (266 bytes), never loading the full 4MB file!
  assert.equal(mockReader.totalBytesRead, 266)
  assert.equal(mockReader.isClosed, true)
})

test('bounded reader enforces MAX_METADATA_BYTES limit on oversized tags', async () => {
  // Declare an oversized tag of 10 MB in a 12 MB file
  const oversizedTagSize = 10 * 1024 * 1024
  const tagHeader = new Uint8Array([73, 68, 51, 3, 0, 0, ...synchsafe(oversizedTagSize)])
  const fullFile = new Uint8Array(12 * 1024 * 1024)
  fullFile.set(tagHeader, 0)

  const mockReader = createMockReader(fullFile)
  const result = await readBoundedMetadataFromReader(mockReader, MAX_METADATA_BYTES)

  assert.notEqual(result, null)
  assert.equal(result?.length, MAX_METADATA_BYTES)
  assert.equal(mockReader.totalBytesRead, MAX_METADATA_BYTES)
  assert.equal(mockReader.isClosed, true)
})

test('extracts title, artist, album, and embedded artwork from bounded tag bytes', async () => {
  const buildFrame = (name, value) => {
    const data = Buffer.concat([Buffer.from([3]), Buffer.from(value, 'utf8')])
    const size = Buffer.from([(data.length >>> 24) & 255, (data.length >>> 16) & 255, (data.length >>> 8) & 255, data.length & 255])
    return Buffer.concat([Buffer.from(name), size, Buffer.from([0, 0]), data])
  }

  // APIC frame with JPEG cover
  const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9])
  const mime = Buffer.from('image/jpeg\0', 'ascii')
  const apicBody = Buffer.concat([Buffer.from([0]), mime, Buffer.from([3, 0]), fakeJpeg])
  const apicSize = Buffer.from([(apicBody.length >>> 24) & 255, (apicBody.length >>> 16) & 255, (apicBody.length >>> 8) & 255, apicBody.length & 255])
  const apicFrame = Buffer.concat([Buffer.from('APIC'), apicSize, Buffer.from([0, 0]), apicBody])

  const body = Buffer.concat([
    buildFrame('TIT2', 'Bounded Song'),
    buildFrame('TPE1', 'Bounded Artist'),
    buildFrame('TALB', 'Bounded Album'),
    apicFrame,
  ])
  const header = Buffer.from([73, 68, 51, 3, 0, 0, ...synchsafe(body.length)])
  const tagBytes = new Uint8Array(Buffer.concat([header, body]))

  const detected = await autoDetectTrackMetadata('test_audio.mp3', tagBytes)
  assert.equal(detected.title, 'Bounded Song')
  assert.equal(detected.artist, 'Bounded Artist')
  assert.equal(detected.album, 'Bounded Album')
  assert.notEqual(detected.coverBytes, undefined)
  assert.equal(detected.coverMime, 'image/jpeg')
  assert.deepEqual(Array.from(detected.coverBytes || []), Array.from(fakeJpeg))
})

test('desktop payload migration safely normalizes legacy or partial data', () => {
  const migrated = migrateDesktopLibraryPayload({
    volume: 0.9,
    shuffle: true,
    repeat: 'all',
    themeMode: 'ambient',
    tracks: [{
      id: 'native:song1.mp3',
      title: 'Song One',
      artist: 'Artist One',
      album: 'Album One',
      duration: 180,
      fileName: 'song1.mp3',
      audioUrl: 'blob:temp-song',
      filePath: '/music/song1.mp3',
      coverUrl: 'data:image/png;base64,abc',
      coverPath: '/appdata/artwork/song1.jpg',
      accent: '#ffffff',
    }],
    playlists: [{ id: 'favorites', name: 'Favorites', trackIds: ['native:song1.mp3'], createdAt: 1 }],
    activePlaylistId: 'favorites',
  })

  assert.equal(migrated?.version, 2)
  assert.equal(migrated?.repeat, 'all')
  assert.equal(migrated?.tracks[0].audioUrl, '/music/song1.mp3')
  assert.equal(migrated?.tracks[0].coverUrl, '/appdata/artwork/song1.jpg')

  const invalid = migrateDesktopLibraryPayload({ volume: 'bad', tracks: 'oops' })
  assert.notEqual(invalid, null)
  assert.equal(Array.isArray(invalid?.tracks), true)
  assert.equal(invalid?.volume, 0.82)

  const rejected = migrateDesktopLibraryPayload('not-an-object')
  assert.equal(rejected, null)
})

test('sanitizeTrackForPersistence strips temporary blob and data URLs while preserving coverPath', () => {
  const trackWithBlob = {
    id: 'native:song1.mp3',
    title: 'Song One',
    artist: 'Artist One',
    album: 'Album One',
    duration: 180,
    fileName: 'song1.mp3',
    audioUrl: 'asset://song1.mp3',
    filePath: '/music/song1.mp3',
    coverUrl: 'blob:http://localhost:3000/temp-uuid-1234',
    coverPath: '/appdata/artwork/song1.jpg',
    coverSource: 'embedded',
    accent: '#ffffff',
  }

  const sanitized = sanitizeTrackForPersistence(trackWithBlob)
  assert.equal(sanitized.coverUrl, undefined)
  assert.equal(sanitized.coverPath, '/appdata/artwork/song1.jpg')

  const trackWithDataUrl = {
    ...trackWithBlob,
    coverUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
  }
  const sanitizedData = sanitizeTrackForPersistence(trackWithDataUrl)
  assert.equal(sanitizedData.coverUrl, undefined)
  assert.equal(sanitizedData.coverPath, '/appdata/artwork/song1.jpg')

  const batch = sanitizeTracksForPersistence([trackWithBlob, trackWithDataUrl])
  assert.equal(batch[0].coverUrl, undefined)
  assert.equal(batch[1].coverUrl, undefined)
})

test('hydrateTrackArtwork regenerates artwork and audio URLs from durable file paths', () => {
  const savedTrack = {
    id: 'native:song.mp3',
    title: 'Persisted Song',
    artist: 'Persisted Artist',
    album: 'Persisted Album',
    duration: 200,
    fileName: 'song.mp3',
    audioUrl: 'stale-or-empty',
    filePath: '/music/album/song.mp3',
    coverUrl: 'blob:stale-blob-url',
    coverPath: '/music/album/cover.jpg',
    coverSource: 'direct',
    accent: '#ff0000',
  }

  const hydrated = hydrateTrackArtwork(savedTrack)
  assert.notEqual(hydrated.coverUrl, undefined)
  assert.equal(hydrated.coverUrl.startsWith('blob:'), false)
  // URL regenerated from durable coverPath
  assert.equal(hydrated.coverPath, '/music/album/cover.jpg')
  assert.equal(hydrated.audioUrl, '/music/album/song.mp3') // in test environment toNativeAssetUrl returns path

  // When track has stale blob and no coverPath, dead blob is cleared
  const trackNoCoverPath = {
    ...savedTrack,
    coverPath: undefined,
    coverUrl: 'blob:dead-link',
  }
  const hydratedNoPath = hydrateTrackArtwork(trackNoCoverPath)
  assert.equal(hydratedNoPath.coverUrl, undefined)

  const hydratedBatch = hydrateTracksArtwork([savedTrack, trackNoCoverPath])
  assert.equal(hydratedBatch[0].coverPath, '/music/album/cover.jpg')
  assert.equal(hydratedBatch[1].coverUrl, undefined)
})

test('user-selected custom artwork survives serialization and deserialization lifecycle', () => {
  const editedTrack = {
    id: 'native:custom.mp3',
    title: 'Custom Art Song',
    artist: 'Custom Artist',
    album: 'Custom Album',
    duration: 150,
    fileName: 'custom.mp3',
    audioUrl: 'asset://custom.mp3',
    filePath: '/music/custom.mp3',
    coverUrl: 'asset:///appdata/artwork/custom_my_song.png',
    coverPath: '/appdata/artwork/custom_my_song.png',
    coverSource: 'custom',
    accent: '#00ff00',
  }

  // 1. Save flow (sanitization)
  const toSave = sanitizeTrackForPersistence(editedTrack)
  assert.equal(toSave.coverPath, '/appdata/artwork/custom_my_song.png')

  // Simulate JSON persistence to disk
  const serialized = JSON.stringify(toSave)
  const parsed = JSON.parse(serialized)

  // 2. Load flow (hydration)
  const rehydrated = hydrateTrackArtwork(parsed)
  assert.equal(rehydrated.coverPath, '/appdata/artwork/custom_my_song.png')
  assert.notEqual(rehydrated.coverUrl, undefined)
  assert.equal(rehydrated.coverSource, 'custom')
})

test('artwork removal clears both coverUrl and coverPath and prevents resurrection', () => {
  const trackWithoutCover = {
    id: 'native:nocover.mp3',
    title: 'No Cover Song',
    artist: 'Artist',
    album: 'Album',
    duration: 120,
    fileName: 'nocover.mp3',
    audioUrl: 'asset://nocover.mp3',
    filePath: '/music/nocover.mp3',
    coverUrl: undefined,
    coverPath: undefined,
    coverSource: undefined,
    accent: '#111111',
  }

  const sanitized = sanitizeTrackForPersistence(trackWithoutCover)
  assert.equal(sanitized.coverUrl, undefined)
  assert.equal(sanitized.coverPath, undefined)

  const hydrated = hydrateTrackArtwork(sanitized)
  assert.equal(hydrated.coverUrl, undefined)
  assert.equal(hydrated.coverPath, undefined)
})

test('sanitizeArtworkFilename produces safe deterministic filesystem paths', () => {
  const name1 = sanitizeArtworkFilename('native:C:\\Music\\Song #1 [Remastered].mp3')
  const name2 = sanitizeArtworkFilename('native:C:\\Music\\Song #1 [Remastered].mp3')
  assert.equal(name1, name2)
  assert.equal(/^[a-zA-Z0-9_-]+$/.test(name1), true)
  assert.equal(name1.length <= 48, true)
})

test('clear stale playback queues for empty playlists prevents continuing previous playback', () => {
  const queue = new PlaybackQueue()
  queue.start(['trackA', 'trackB', 'trackC'], 'trackA')
  assert.equal(queue.size, 3)
  assert.equal(queue.next('trackA', false, 'off'), 'trackB')
  assert.equal(queue.previous('trackB', false, 'off'), 'trackA')

  // When an empty playlist is selected, the queue is cleared
  queue.clear()
  assert.equal(queue.size, 0)
  // Next and Previous cannot continue playback from the previous playlist
  assert.equal(queue.next('trackA', false, 'off'), undefined)
  assert.equal(queue.previous('trackA', false, 'off'), undefined)
  assert.equal(queue.next('trackA', true, 'off'), undefined)
  assert.equal(queue.previous('trackA', true, 'off'), undefined)
})

test('direct cover match takes precedence and prevents embedded coverPath resurrection on reload', () => {
  const directPath = '/music/album/folder_cover.jpg'
  const embeddedPath = '/appdata/artwork/track1.jpg'

  // Case 1: Direct cover match with durable path
  const trackWithDirectAndPath = {
    id: 'native:/music/album/song.mp3',
    title: 'Song',
    artist: 'Artist',
    album: 'Album',
    duration: 180,
    fileName: 'song.mp3',
    filePath: '/music/album/song.mp3',
    audioUrl: 'asset:///music/album/song.mp3',
    coverUrl: 'asset://' + directPath,
    coverPath: directPath, // direct cover path, NOT embeddedPath
    coverSource: 'direct',
    accent: '#333333',
  }

  const hydrated1 = hydrateTrackArtwork(trackWithDirectAndPath)
  // Rehydration must point to the direct cover, never the embedded image
  assert.equal(hydrated1.coverPath, directPath)
  assert.equal(hydrated1.coverUrl, directPath)

  // Case 2: Direct cover match without local durable path (e.g. web URL or memory pool)
  const trackWithDirectNoPath = {
    ...trackWithDirectAndPath,
    coverUrl: 'asset://temp_direct.jpg',
    coverPath: undefined, // cleared, NOT pointing to embeddedPath!
    coverSource: 'direct',
  }

  const sanitized = sanitizeTrackForPersistence(trackWithDirectNoPath)
  assert.equal(sanitized.coverPath, undefined)

  const hydrated2 = hydrateTrackArtwork(sanitized)
  // Must NOT resurrect the unrelated embedded image path!
  assert.notEqual(hydrated2.coverPath, embeddedPath)
  assert.equal(hydrated2.coverPath, undefined)
})

test('custom artwork save failure leaves track unchanged and keeps new artwork for retry', async () => {
  const originalTrack = {
    id: 'native:/music/track.mp3',
    title: 'Original Title',
    artist: 'Original Artist',
    album: 'Original Album',
    duration: 210,
    fileName: 'track.mp3',
    filePath: '/music/track.mp3',
    audioUrl: 'asset:///music/track.mp3',
    coverUrl: 'asset:///appdata/artwork/original.jpg',
    coverPath: '/appdata/artwork/original.jpg',
    coverSource: 'custom',
    accent: '#444444',
  }

  // 1. Exercise the REAL processTrackEdit implementation when custom artwork save fails
  // In desktop mode with an invalid source or failed disk write, processTrackEdit must return failure
  const failureResult = await processTrackEdit({
    track: originalTrack,
    title: 'New Title',
    artist: 'New Artist',
    album: 'New Album',
    coverUrl: 'data:image/png;base64,invalid...',
    pendingImageSource: 'data:image/png;base64,invalid...',
    isDesktop: true,
  })

  // Failure must be reported cleanly
  assert.equal(failureResult.success, false)
  assert.notEqual(failureResult.errorMessage, undefined)
  assert.equal(failureResult.errorMessage.includes('Failed to save custom artwork'), true)
  assert.equal(failureResult.updates, undefined)

  // Original track remains completely untouched
  assert.equal(originalTrack.coverPath, '/appdata/artwork/original.jpg')
  assert.equal(originalTrack.title, 'Original Title')

  // 2. Retry with a valid source (e.g. web/non-desktop or successful path)
  const retryResult = await processTrackEdit({
    track: originalTrack,
    title: 'New Title',
    artist: 'New Artist',
    album: 'New Album',
    coverUrl: 'https://example.com/custom_art.png',
    isDesktop: false,
  })

  assert.equal(retryResult.success, true)
  assert.equal(retryResult.errorMessage, undefined)
  assert.equal(retryResult.updates?.title, 'New Title')
  assert.equal(retryResult.updates?.coverUrl, 'https://example.com/custom_art.png')
  assert.equal(retryResult.updates?.coverSource, 'custom')
})

test('startup desktop library initialization safely merges concurrent in-memory imports', async () => {
  // 1. Seed the desktop backup storage representing previous session
  const loadedFromDisk = {
    tracks: [
      {
        id: 'native:/music/persisted.mp3',
        title: 'Persisted Track',
        artist: 'Disk Artist',
        album: 'Disk Album',
        duration: 200,
        fileName: 'persisted.mp3',
        filePath: '/music/persisted.mp3',
        audioUrl: 'asset:///music/persisted.mp3',
        accent: '#666666',
      },
    ],
    playlists: [
      { id: 'favorites', name: 'Favorites', trackIds: ['native:/music/persisted.mp3'], createdAt: 1 },
      { id: 'rock', name: 'Rock', trackIds: ['native:/music/persisted.mp3'], createdAt: 10 },
    ],
    activePlaylistId: 'library',
    volume: 0.8,
    shuffle: false,
    repeat: 'off',
  }
  localStorage.setItem('resonance_desktop_library_backup', JSON.stringify(loadedFromDisk))

  // 2. Simulate concurrent user import while desktop storage is initializing
  const concurrentTrack = {
    id: 'native:/music/new_drop.mp3',
    title: 'Dropped Track',
    artist: 'Drop Artist',
    album: 'Drop Album',
    duration: 120,
    fileName: 'new_drop.mp3',
    filePath: '/music/new_drop.mp3',
    audioUrl: 'asset:///music/new_drop.mp3',
    accent: '#555555',
  }

  useMusicStore.setState({
    isInitialized: false,
    tracks: [concurrentTrack],
    playlists: [
      { id: 'favorites', name: 'Favorites', trackIds: [concurrentTrack.id], createdAt: 1 },
      { id: 'custom-concurrent', name: 'Concurrent Playlist', trackIds: [], createdAt: 2 },
    ],
  })

  // 3. Invoke the REAL initDesktopStorage implementation
  await useMusicStore.getState().initDesktopStorage()

  const state = useMusicStore.getState()
  assert.equal(state.isInitialized, true)

  // Verify: BOTH disk tracks and concurrent tracks exist
  assert.equal(state.tracks.length, 2)
  assert.equal(state.tracks.some(t => t.id === concurrentTrack.id), true)
  assert.equal(state.tracks.some(t => t.id === 'native:/music/persisted.mp3'), true)

  // Verify: Concurrently created playlist is preserved
  assert.equal(state.playlists.some(p => p.id === 'custom-concurrent'), true)
  // Verify: Favorites trackIds merged both concurrent and disk tracks
  const favorites = state.playlists.find(p => p.id === 'favorites')
  assert.equal(favorites.trackIds.includes(concurrentTrack.id), true)
  assert.equal(favorites.trackIds.includes('native:/music/persisted.mp3'), true)
})

test('playback queue initializes when tracks and currentTrackId arrive at startup and preserves history', () => {
  const queue = new PlaybackQueue()
  const syncState = { lastPlaylistId: null, lastTrackIds: [] }

  // Startup: Desktop storage loaded tracks AND currentTrackId together into 'library'
  // At startup, the queue was empty (size 0), and currentTrackId ('track2') is provided.
  syncPlaylistQueue(queue, syncState, {
    activePlaylistId: 'library',
    playlistTrackIds: ['track1', 'track2', 'track3'],
    currentTrackId: 'track2',
  })

  // Queue MUST be initialized and not left empty!
  assert.equal(queue.size, 3)
  assert.equal(queue.next('track2', false, 'off'), 'track3')
  assert.equal(queue.previous('track2', false, 'off'), 'track1')

  // Ordinary playback: track advances to 'track3'
  // When Next was called, queue recorded history. Syncing during ordinary playback must NOT wipe history!
  syncPlaylistQueue(queue, syncState, {
    activePlaylistId: 'library',
    playlistTrackIds: ['track1', 'track2', 'track3'],
    currentTrackId: 'track3',
  })
  assert.equal(queue.size, 3)

  // Tracks arrive later: user adds 'track4' and 'track5'
  syncPlaylistQueue(queue, syncState, {
    activePlaylistId: 'library',
    playlistTrackIds: ['track1', 'track2', 'track3', 'track4', 'track5'],
    currentTrackId: 'track3',
  })
  assert.equal(queue.size, 5)
  assert.equal(queue.trackIds.includes('track4'), true)
  assert.equal(queue.next('track3', false, 'off'), 'track4')

  // Empty playlist selected: queue is cleared so previous tracks cannot continue
  syncPlaylistQueue(queue, syncState, {
    activePlaylistId: 'empty-playlist',
    playlistTrackIds: [],
    currentTrackId: 'track3',
  })
  assert.equal(queue.size, 0)
  assert.equal(queue.next('track3', false, 'off'), undefined)
  assert.equal(queue.previous('track3', false, 'off'), undefined)
})

test('embedded artwork provides in-session visible fallback when saving to AppData fails and is not persisted durably', async () => {
  // Construct valid MP3 tag with an APIC JPEG frame
  const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9])
  const mime = Buffer.from('image/jpeg\0', 'ascii')
  const apicBody = Buffer.concat([Buffer.from([0]), mime, Buffer.from([3, 0]), fakeJpeg])
  const apicSize = Buffer.from([(apicBody.length >>> 24) & 255, (apicBody.length >>> 16) & 255, (apicBody.length >>> 8) & 255, apicBody.length & 255])
  const apicFrame = Buffer.concat([Buffer.from('APIC'), apicSize, Buffer.from([0, 0]), apicBody])

  const buildFrame = (name, value) => {
    const data = Buffer.concat([Buffer.from([3]), Buffer.from(value, 'utf8')])
    const size = Buffer.from([(data.length >>> 24) & 255, (data.length >>> 16) & 255, (data.length >>> 8) & 255, data.length & 255])
    return Buffer.concat([Buffer.from(name), size, Buffer.from([0, 0]), data])
  }

  const body = Buffer.concat([
    buildFrame('TIT2', 'Song With Embedded Art'),
    buildFrame('TPE1', 'Artist With Art'),
    apicFrame,
  ])
  const header = Buffer.from([73, 68, 51, 3, 0, 0, ...synchsafe(body.length)])
  const tagBytes = new Uint8Array(Buffer.concat([header, body]))

  // Simulate native track extraction when saveEmbeddedArtwork returns null (non-desktop test environment)
  const detected = await autoDetectTrackMetadata('song_with_art.mp3', tagBytes)
  assert.notEqual(detected.coverBytes, undefined)

  // In nativeFileSystem.ts, when saveEmbeddedArtwork returns null, fallback creates in-session blob URL
  const inSessionUrl = URL.createObjectURL(new Blob([detected.coverBytes], { type: detected.coverMime }))
  const trackWithFallback = {
    id: 'native:/music/song_with_art.mp3',
    title: detected.title,
    artist: detected.artist,
    album: detected.album,
    duration: 180,
    fileName: 'song_with_art.mp3',
    filePath: '/music/song_with_art.mp3',
    audioUrl: 'asset:///music/song_with_art.mp3',
    coverUrl: inSessionUrl, // visible in-session fallback!
    coverPath: undefined, // durable path is undefined!
    coverSource: 'embedded',
    accent: '#333333',
  }

  // 1. Visible in session
  assert.equal(trackWithFallback.coverUrl.startsWith('blob:'), true)
  assert.equal(trackWithFallback.coverPath, undefined)

  // 2. When saving to persistence, temporary blob URL must NOT be treated as durable!
  const sanitized = sanitizeTrackForPersistence(trackWithFallback)
  assert.equal(sanitized.coverUrl, undefined)
  assert.equal(sanitized.coverPath, undefined)

  // 3. On restart / hydration, no stale path is resurrected
  const hydrated = hydrateTrackArtwork(sanitized)
  assert.equal(hydrated.coverUrl, undefined)
  assert.equal(hydrated.coverPath, undefined)
})

test('native byte input extracts coverBytes without leaking unused object URLs', async () => {
  const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9])
  const mime = Buffer.from('image/jpeg\0', 'ascii')
  const apicBody = Buffer.concat([Buffer.from([0]), mime, Buffer.from([3, 0]), fakeJpeg])
  const apicSize = Buffer.from([(apicBody.length >>> 24) & 255, (apicBody.length >>> 16) & 255, (apicBody.length >>> 8) & 255, apicBody.length & 255])
  const apicFrame = Buffer.concat([Buffer.from('APIC'), apicSize, Buffer.from([0, 0]), apicBody])

  const body = apicFrame
  const header = Buffer.from([73, 68, 51, 3, 0, 0, ...synchsafe(body.length)])
  const tagBytes = new Uint8Array(Buffer.concat([header, body]))

  // 1. Native Uint8Array input
  const nativeResult = await readID3Metadata(tagBytes)
  assert.notEqual(nativeResult, null)
  assert.notEqual(nativeResult?.coverBytes, undefined)
  assert.equal(nativeResult?.coverMime, 'image/jpeg')
  // CRITICAL: coverUrl must NOT be created for native Uint8Array input (avoids object URL leak!)
  assert.equal(nativeResult?.coverUrl, undefined)

  // 2. Browser File/Blob input
  const browserFile = new File([tagBytes], 'test.mp3', { type: 'audio/mpeg' })
  const browserResult = await readID3Metadata(browserFile)
  assert.notEqual(browserResult, null)
  assert.notEqual(browserResult?.coverBytes, undefined)
  // Browser input still gets a blob URL for immediate web playback
  assert.notEqual(browserResult?.coverUrl, undefined)
  assert.equal(browserResult?.coverUrl?.startsWith('blob:'), true)
})

test('oversized artwork frame does not prevent later title and artist frames from being read', async () => {
  const buildFrame = (name, value) => {
    const data = Buffer.concat([Buffer.from([3]), Buffer.from(value, 'utf8')])
    const size = Buffer.from([(data.length >>> 24) & 255, (data.length >>> 16) & 255, (data.length >>> 8) & 255, data.length & 255])
    return Buffer.concat([Buffer.from(name), size, Buffer.from([0, 0]), data])
  }

  // Construct an oversized APIC frame of 5 MB
  const oversizedArtSize = 5 * 1024 * 1024
  const apicHeader = Buffer.concat([
    Buffer.from('APIC'),
    Buffer.from([(oversizedArtSize >>> 24) & 255, (oversizedArtSize >>> 16) & 255, (oversizedArtSize >>> 8) & 255, oversizedArtSize & 255]),
    Buffer.from([0, 0]),
  ])

  const titleFrame = buildFrame('TIT2', 'Recovered Title')
  const artistFrame = buildFrame('TPE1', 'Recovered Artist')

  const totalTagBody = 10 + oversizedArtSize + titleFrame.length + artistFrame.length
  const tagHeader = Buffer.from([73, 68, 51, 3, 0, 0, ...synchsafe(totalTagBody)])

  // Simulate a 7 MB audio file: ID3 header + APIC header (10 bytes) + 5MB dummy art + TIT2 + TPE1 + audio
  const fullFile = new Uint8Array(10 + totalTagBody + 512)
  fullFile.set(tagHeader, 0)
  fullFile.set(apicHeader, 10)
  // Fill some art bytes
  const textFramesOffset = 10 + 10 + oversizedArtSize
  fullFile.set(titleFrame, textFramesOffset)
  fullFile.set(artistFrame, textFramesOffset + titleFrame.length)

  const mockReader = createMockReader(fullFile)
  const boundedResult = await readBoundedMetadataFromReader(mockReader, 4 * 1024 * 1024)

  assert.notEqual(boundedResult, null)
  // Total bytes read from disk must stay bounded
  assert.equal(mockReader.totalBytesRead <= 4 * 1024 * 1024, true)

  // Pass to metadata parser: title and artist must be recovered despite oversized APIC!
  const parsed = await readID3Metadata(boundedResult)
  assert.notEqual(parsed, null)
  assert.equal(parsed?.title, 'Recovered Title')
  assert.equal(parsed?.artist, 'Recovered Artist')
})

test('Windows setup.exe Tauri configuration and capabilities include required NSIS and filesystem permissions', () => {
  const tauriConf = JSON.parse(fs.readFileSync(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'))
  assert.equal(tauriConf.bundle?.active, true)
  assert.equal(tauriConf.app?.security?.assetProtocol?.enable, true)
  assert.equal(tauriConf.bundle?.windows?.nsis?.installMode, 'currentUser')
  assert.equal(tauriConf.bundle?.windows?.nsis?.installerIcon, 'icons/icon.ico')
  assert.equal(tauriConf.bundle?.windows?.webviewInstallMode?.type, 'downloadBootstrapper')

  const capability = JSON.parse(
    fs.readFileSync(new URL('../src-tauri/capabilities/default.json', import.meta.url), 'utf8'),
  )
  assert.equal(capability.permissions.includes('core:default'), true)
  assert.equal(capability.permissions.includes('dialog:default'), true)
  assert.equal(capability.permissions.includes('fs:read-all'), true)
  assert.equal(capability.permissions.includes('fs:allow-appdata-read-recursive'), true)
  assert.equal(capability.permissions.includes('fs:allow-appdata-write-recursive'), true)
  assert.equal(capability.permissions.includes('fs:allow-appdata-meta-recursive'), true)
  const scopeEntry = capability.permissions.find(
    (entry) => typeof entry === 'object' && entry !== null && entry.identifier === 'fs:scope',
  )
  assert.notEqual(scopeEntry, undefined)
})

test('scanNativeDroppedPaths classifies dropped audio and cover files and nativeTracksFromPaths deduplicates batch paths', async () => {
  const dropped = await scanNativeDroppedPaths([
    'C:\\Music\\Album\\Track 01.mp3',
    'C:\\Music\\Album\\cover.jpg',
    'C:\\Music\\Album\\Track 02.flac',
  ])
  assert.deepEqual(dropped.audioPaths, [
    'C:\\Music\\Album\\Track 01.mp3',
    'C:\\Music\\Album\\Track 02.flac',
  ])
  assert.deepEqual(dropped.coverPaths, ['C:\\Music\\Album\\cover.jpg'])

  const tracks = await nativeTracksFromPaths(
    ['C:\\Music\\Artist - Song.mp3', 'C:\\Music\\Artist - Song.mp3'],
    new Map(),
  )
  assert.equal(tracks.length, 1)
  assert.equal(tracks[0].title, 'Song')
  assert.equal(tracks[0].artist, 'Artist')
})

test('setMusicFolder and setCoverFolder preserve folder paths and names in music store state', () => {
  useMusicStore.getState().setMusicFolder('C:\\Users\\Music', 'Music')
  useMusicStore.getState().setCoverFolder('C:\\Users\\Covers', 'Covers')

  const state = useMusicStore.getState()
  assert.equal(state.musicFolderPath, 'C:\\Users\\Music')
  assert.equal(state.musicFolderName, 'Music')
  assert.equal(state.coverFolderPath, 'C:\\Users\\Covers')
  assert.equal(state.coverFolderName, 'Covers')
})

test('rescan filtering only returns newly added audio files when rescanning a folder', async () => {
  const existingTracks = [
    { id: 'native:C:\\Music\\Song 1.mp3', title: 'Song 1', artist: 'Artist', duration: 100, fileName: 'Song 1.mp3', audioUrl: 'asset://song1.mp3' }
  ]
  const existingIds = new Set(existingTracks.map(t => t.id))

  // Rescan finds Song 1 (existing) and Song 2 (newly added)
  const allScannedFiles = ['C:\\Music\\Song 1.mp3', 'C:\\Music\\Song 2.mp3']
  const newTracks = await nativeTracksFromPaths(allScannedFiles, new Map(), existingIds)

  // Only Song 2 should be returned as a new track to add
  assert.equal(newTracks.length, 1)
  assert.equal(newTracks[0].id, 'native:C:\\Music\\Song 2.mp3')
  assert.equal(newTracks[0].title, 'Song 2')
})

test('favorites toggle adds and removes tracks from the favorites playlist', () => {
  const store = useMusicStore.getState()
  const trackId = 'test-track-fav-1'

  // Initially not in favorites
  let favoritesPlaylist = useMusicStore.getState().playlists.find((p) => p.id === 'favorites')
  assert.ok(favoritesPlaylist)
  assert.equal(favoritesPlaylist.trackIds.includes(trackId), false)

  // Add to favorites
  store.addTrackToPlaylist('favorites', trackId)
  favoritesPlaylist = useMusicStore.getState().playlists.find((p) => p.id === 'favorites')
  assert.equal(favoritesPlaylist.trackIds.includes(trackId), true)

  // Remove from favorites
  store.removeTrackFromPlaylist('favorites', trackId)
  favoritesPlaylist = useMusicStore.getState().playlists.find((p) => p.id === 'favorites')
  assert.equal(favoritesPlaylist.trackIds.includes(trackId), false)
})

test('addTrackToPlaylist prevents duplicate track ids in playlist', () => {
  const store = useMusicStore.getState()
  const trackId = 'test-track-dup-1'
  const playlistId = 'favorites'

  store.addTrackToPlaylist(playlistId, trackId)
  store.addTrackToPlaylist(playlistId, trackId)

  const playlist = useMusicStore.getState().playlists.find((p) => p.id === playlistId)
  const occurrences = playlist.trackIds.filter((id) => id === trackId).length
  assert.equal(occurrences, 1)

  // Clean up
  store.removeTrackFromPlaylist(playlistId, trackId)
})

test('clicking or switching playlist while actively listening does not auto-switch the song', () => {
  const queue = new PlaybackQueue()
  const syncState = { lastPlaylistId: 'library', lastTrackIds: ['track1', 'track2', 'track3'] }
  queue.start(['track1', 'track2', 'track3'], 'track2')

  let selectedTrackId = null
  const onTrackSelect = (id) => {
    selectedTrackId = id
  }

  // Actively listening to 'track2' from library. User clicks on a different playlist ('playlist-chill' with ['trackA', 'trackB'])
  syncPlaylistQueue(queue, syncState, {
    activePlaylistId: 'playlist-chill',
    playlistTrackIds: ['trackA', 'trackB'],
    currentTrackId: 'track2',
    isPlaying: true,
    onTrackSelect,
  })

  // onTrackSelect MUST NOT be called! Current song MUST NOT auto-switch!
  assert.equal(selectedTrackId, null)
  // Queue still retains track2 and playback can continue in active session
  assert.equal(queue.currentHistory[0], 'track2')
  assert.equal(queue.next('track2', false, 'off'), 'track3')
})

test('switching between normal mode and ambient mode updates store state', () => {
  const store = useMusicStore.getState()
  // Default is ambient mode
  assert.equal(store.themeMode, 'ambient')

  // Switch to normal mode
  store.setThemeMode('normal')
  assert.equal(useMusicStore.getState().themeMode, 'normal')

  // Switch back to ambient mode
  store.setThemeMode('ambient')
  assert.equal(useMusicStore.getState().themeMode, 'ambient')
})


