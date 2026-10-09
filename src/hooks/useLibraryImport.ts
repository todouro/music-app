import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { useMusicStore } from '../store/useMusicStore'
import { showToast, type ToastType } from '../store/useToastStore'
import {
  extractCovers,
  isAudioFile,
  isCoverFile,
  tracksFromFiles,
} from '../utils/library'
import { isDesktopApp, pickNativeAudioFiles, pickNativeFolder } from '../utils/platform'
import {
  nativeCoversFromPaths,
  nativeTracksFromPaths,
  scanNativeDroppedPaths,
  scanNativeFolder,
} from '../utils/nativeFileSystem'

export function useLibraryImport() {
  const {
    addTracks,
    addCovers,
    musicFolderPath,
    coverFolderPath,
    musicFolderName,
    coverFolderName,
    setMusicFolder,
    setCoverFolder,
  } = useMusicStore()
  const isDesktop = isDesktopApp()

  const [isScanningMusic, setIsScanningMusic] = useState(false)
  const [isScanningCovers, setIsScanningCovers] = useState(false)
  const [scanNotice, setScanNotice] = useState<string | null>(null)
  const noticeTimerRef = useRef<number | null>(null)

  const showNotice = useCallback(
    (
      message: string,
      type: ToastType = 'success',
      title = 'Library Updated',
    ) => {
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current)
      }
      setScanNotice(message)
      showToast(message, { title, type })
      noticeTimerRef.current = window.setTimeout(() => {
        setScanNotice(null)
        noticeTimerRef.current = null
      }, 3800)
    },
    [],
  )

  const importNativeScanResult = useCallback(
    async (audioPaths: string[], coverPaths: string[]) => {
      const storeLookup = useMusicStore.getState().coverLookup
      const combinedLookup = new Map(storeLookup)

      let coverPathsMap: Map<string, string> | undefined
      let addedCoversCount = 0

      if (coverPaths.length > 0) {
        const { lookup, paths, urls } = nativeCoversFromPaths(coverPaths)
        coverPathsMap = paths
        for (const [k, v] of lookup.entries()) {
          if (!combinedLookup.has(k)) {
            addedCoversCount++
          }
          combinedLookup.set(k, v)
        }
        addCovers(lookup, urls)
      }

      let addedTracksCount = 0
      if (audioPaths.length > 0) {
        const existingIds = new Set(useMusicStore.getState().tracks.map((t) => t.id))
        const parsedTracks = await nativeTracksFromPaths(
          audioPaths,
          combinedLookup,
          existingIds,
          coverPathsMap,
        )
        if (parsedTracks.length > 0) {
          addedTracksCount = parsedTracks.length
          addTracks(parsedTracks)
        }
      }

      return { addedTracksCount, addedCoversCount }
    },
    [addCovers, addTracks],
  )

  useEffect(() => {
    if (!isDesktop) return
    let unlisten: (() => void) | undefined
    let cancelled = false

    getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type === 'drop' && event.payload.paths.length > 0) {
          void scanNativeDroppedPaths(event.payload.paths).then(({ audioPaths, coverPaths }) =>
            importNativeScanResult(audioPaths, coverPaths),
          )
        }
      })
      .then((fn) => {
        if (cancelled) {
          fn()
        } else {
          unlisten = fn
        }
      })
      .catch((err) => {
        console.warn('Could not register native drag-drop listener:', err)
      })

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [isDesktop, importNativeScanResult])

  // Native desktop handlers using OS dialogs
  async function handleNativeAddSongs() {
    const filePaths = await pickNativeAudioFiles()
    if (!filePaths || filePaths.length === 0) return

    const storeLookup = useMusicStore.getState().coverLookup
    const existingIds = new Set(useMusicStore.getState().tracks.map((t) => t.id))
    const parsedTracks = await nativeTracksFromPaths(filePaths, storeLookup, existingIds)
    if (parsedTracks.length > 0) {
      addTracks(parsedTracks)
      showNotice(
        parsedTracks.length === 1
          ? '1 song imported successfully'
          : `${parsedTracks.length} songs imported successfully`,
        'success',
        'Import Successful',
      )
    } else {
      showNotice('All selected songs are already in your library', 'info', 'Library Up to Date')
    }
  }

  async function handleNativeMusicFolder() {
    const folderPath = await pickNativeFolder()
    if (!folderPath) return

    const folderName = folderPath.split(/[/\\]/).filter(Boolean).pop() || folderPath
    setMusicFolder(folderPath, folderName)

    setIsScanningMusic(true)
    try {
      const { audioPaths, coverPaths } = await scanNativeFolder(folderPath)
      const result = await importNativeScanResult(audioPaths, coverPaths)
      if (result.addedTracksCount > 0) {
        showNotice(
          result.addedTracksCount === 1
            ? '1 song imported successfully'
            : `${result.addedTracksCount} songs imported successfully`,
          'success',
          'Import Successful',
        )
      } else {
        showNotice(`Library is up to date (${audioPaths.length} songs found)`, 'info', 'Folder Scanned')
      }
    } finally {
      setIsScanningMusic(false)
    }
  }

  async function handleRescanMusicFolder() {
    if (isDesktop) {
      const currentPath = useMusicStore.getState().musicFolderPath
      if (!currentPath) {
        await handleNativeMusicFolder()
        return
      }

      setIsScanningMusic(true)
      try {
        const { audioPaths, coverPaths } = await scanNativeFolder(currentPath)
        const result = await importNativeScanResult(audioPaths, coverPaths)
        if (result.addedTracksCount > 0) {
          showNotice(
            result.addedTracksCount === 1
              ? '1 new song imported successfully'
              : `${result.addedTracksCount} new songs imported successfully`,
            'success',
            'Import Successful',
          )
        } else {
          showNotice('Music folder is up to date (no new files)', 'info', 'Library Up to Date')
        }
      } catch (err) {
        console.warn('Rescan music folder failed:', err)
        showNotice('Failed to scan music folder', 'error', 'Scan Error')
      } finally {
        setIsScanningMusic(false)
      }
    } else {
      if ('showDirectoryPicker' in window) {
        try {
          setIsScanningMusic(true)
          // @ts-expect-error window.showDirectoryPicker
          const dirHandle = await window.showDirectoryPicker()
          if (dirHandle) {
            setMusicFolder(undefined, dirHandle.name)
            const files: File[] = []
            async function readEntries(dir: any, pathPrefix = '') {
              for await (const entry of dir.values()) {
                if (entry.kind === 'file') {
                  const f = await entry.getFile()
                  Object.defineProperty(f, 'webkitRelativePath', {
                    value: pathPrefix ? `${pathPrefix}/${f.name}` : f.name,
                    writable: true,
                  })
                  files.push(f)
                } else if (entry.kind === 'directory') {
                  await readEntries(entry, pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name)
                }
              }
            }
            await readEntries(dirHandle)
            await processWebMusicFiles(files)
          }
        } catch (err: any) {
          if (err?.name !== 'AbortError') {
            console.warn('Web directory picker error:', err)
          }
        } finally {
          setIsScanningMusic(false)
        }
      }
    }
  }

  async function handleNativeCoverFolder() {
    const folderPath = await pickNativeFolder()
    if (!folderPath) return

    const folderName = folderPath.split(/[/\\]/).filter(Boolean).pop() || folderPath
    setCoverFolder(folderPath, folderName)

    setIsScanningCovers(true)
    try {
      const { coverPaths } = await scanNativeFolder(folderPath)
      if (coverPaths.length > 0) {
        const { lookup, urls } = nativeCoversFromPaths(coverPaths)
        if (urls.length > 0) {
          addCovers(lookup, urls)
          showNotice(
            urls.length === 1
              ? '1 cover artwork imported successfully'
              : `${urls.length} cover artworks imported successfully`,
            'success',
            'Covers Imported',
          )
        }
      } else {
        showNotice('No cover artwork files found', 'info', 'Covers Notice')
      }
    } finally {
      setIsScanningCovers(false)
    }
  }

  async function handleRescanCoverFolder() {
    if (isDesktop) {
      const currentPath = useMusicStore.getState().coverFolderPath
      if (!currentPath) {
        await handleNativeCoverFolder()
        return
      }

      setIsScanningCovers(true)
      try {
        const { coverPaths } = await scanNativeFolder(currentPath)
        if (coverPaths.length > 0) {
          const { lookup, urls } = nativeCoversFromPaths(coverPaths)
          if (urls.length > 0) {
            addCovers(lookup, urls)
            showNotice(
              urls.length === 1
                ? '1 cover artwork updated successfully'
                : `${urls.length} cover artworks updated successfully`,
              'success',
              'Covers Updated',
            )
          }
        } else {
          showNotice('Cover folder is up to date (no new files)', 'info', 'Covers Up to Date')
        }
      } catch (err) {
        console.warn('Rescan cover folder failed:', err)
        showNotice('Failed to scan cover folder', 'error', 'Scan Error')
      } finally {
        setIsScanningCovers(false)
      }
    } else {
      if ('showDirectoryPicker' in window) {
        try {
          setIsScanningCovers(true)
          // @ts-expect-error window.showDirectoryPicker
          const dirHandle = await window.showDirectoryPicker()
          if (dirHandle) {
            setCoverFolder(undefined, dirHandle.name)
            const files: File[] = []
            async function readEntries(dir: any, pathPrefix = '') {
              for await (const entry of dir.values()) {
                if (entry.kind === 'file') {
                  const f = await entry.getFile()
                  Object.defineProperty(f, 'webkitRelativePath', {
                    value: pathPrefix ? `${pathPrefix}/${f.name}` : f.name,
                    writable: true,
                  })
                  files.push(f)
                } else if (entry.kind === 'directory') {
                  await readEntries(entry, pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name)
                }
              }
            }
            await readEntries(dirHandle)
            processWebCoverFiles(files)
          }
        } catch (err: any) {
          if (err?.name !== 'AbortError') {
            console.warn('Web directory picker error:', err)
          }
        } finally {
          setIsScanningCovers(false)
        }
      }
    }
  }

  // Web helper functions
  async function processWebMusicFiles(files: File[]) {
    if (files.length === 0) return

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

    const parsedTracks = await tracksFromFiles(
      files,
      combinedLookup,
      new Set(useMusicStore.getState().tracks.map((track) => track.id)),
    )
    if (parsedTracks.length > 0) {
      addTracks(parsedTracks)
      showNotice(
        parsedTracks.length === 1
          ? '1 song imported successfully'
          : `${parsedTracks.length} songs imported successfully`,
        'success',
        'Import Successful',
      )
    } else {
      showNotice('Music folder is up to date (no new files)', 'info', 'Folder Scanned')
    }
  }

  function processWebCoverFiles(files: File[]) {
    if (files.length === 0) return
    const { lookup, urls } = extractCovers(files)
    if (urls.length > 0) {
      addCovers(lookup, urls)
      showNotice(
        urls.length === 1
          ? '1 cover artwork imported successfully'
          : `${urls.length} cover artworks imported successfully`,
        'success',
        'Covers Imported',
      )
    } else {
      showNotice('No cover artwork files found', 'info', 'Covers Notice')
    }
  }

  // Web browser fallback handlers using HTML inputs
  async function handleMusicFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return

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

    const parsedTracks = await tracksFromFiles(
      files,
      combinedLookup,
      new Set(useMusicStore.getState().tracks.map((track) => track.id)),
    )
    if (parsedTracks.length > 0) {
      addTracks(parsedTracks)
      showNotice(
        parsedTracks.length === 1
          ? '1 song imported successfully'
          : `${parsedTracks.length} songs imported successfully`,
        'success',
        'Import Successful',
      )
    } else {
      showNotice('All selected songs are already in your library', 'info', 'Library Up to Date')
    }
    event.target.value = ''
  }

  async function handleMusicFolder(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return

    if (files[0]?.webkitRelativePath) {
      const rootFolder = files[0].webkitRelativePath.split('/')[0]
      if (rootFolder) setMusicFolder(undefined, rootFolder)
    }

    setIsScanningMusic(true)
    try {
      await processWebMusicFiles(files)
    } finally {
      setIsScanningMusic(false)
    }
    event.target.value = ''
  }

  function handleCoverFolder(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return

    if (files[0]?.webkitRelativePath) {
      const rootFolder = files[0].webkitRelativePath.split('/')[0]
      if (rootFolder) setCoverFolder(undefined, rootFolder)
    }

    setIsScanningCovers(true)
    try {
      processWebCoverFiles(files)
    } finally {
      setIsScanningCovers(false)
    }
    event.target.value = ''
  }

  async function handleDrop(event: DragEvent) {
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
      const parsedTracks = await tracksFromFiles(
        audioFiles,
        combinedLookup,
        new Set(useMusicStore.getState().tracks.map((track) => track.id)),
      )
      if (parsedTracks.length > 0) {
        addTracks(parsedTracks)
        showNotice(
          parsedTracks.length === 1
            ? '1 song imported successfully'
            : `${parsedTracks.length} songs imported successfully`,
          'success',
          'Import Successful',
        )
      }
    }
  }

  return {
    isDesktop,
    musicFolderPath,
    coverFolderPath,
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
  }
}
