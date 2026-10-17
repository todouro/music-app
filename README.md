# Resonance Music Player

A local-first music player for the browser and Windows desktop, built with React 19, TypeScript, Vite, Zustand, Howler.js, Framer Motion, and Tauri.

## Local development

Install Node.js 22.12 or later (Node.js 24 LTS recommended) and npm.

```bash
git clone https://github.com/todouro/resonance.git
cd resonance
npm install
npm run dev
```

Open http://localhost:3000. The development server binds to localhost by default. To intentionally expose it to another device on a trusted network, pass the host option explicitly:

```bash
npm run dev -- --host 0.0.0.0
```

Only expose the development server on networks you trust; it can serve development resources. Do not enable permissive host checks for convenience.

```bash
npm test
npm run lint
npm run build
npm run preview
```

## Building Windows `setup.exe` (Tauri Desktop)

### Option 1: Build locally on Windows

Prerequisites: Node.js 22+, Rust stable toolchain (`rustup`), and Microsoft Visual Studio C++ Build Tools.

```bash
npm install
npm run tauri:build:win
```

The NSIS installer will be output to:
`src-tauri/target/release/bundle/nsis/Resonance_1.1.0_x64-setup.exe`

### Option 2: Build via GitHub Actions

1. Push to `main` or manually trigger the **Verify music player** or **Release Resonance** workflow via `workflow_dispatch` in the **Actions** tab to download the `Resonance-Windows-Setup` artifact containing `Resonance_1.1.0_x64-setup.exe`.
2. Push a version tag (`git tag v1.1.0 && git push origin v1.1.0`) to automatically publish a GitHub Release with `Resonance_1.1.0_x64-setup.exe` and `.msi` installers attached.

## Using Resonance

Import local audio files from **Add songs** or choose a **Music folder**. Embedded metadata extraction currently reads ID3 tags; files using other tag systems may fall back to filename-based guesses. Use **Edit song info** if a title or artist is wrong. Album art can be matched by filename or folder. Add tracks to playlists and Favorites, search your library, and use the player controls to shuffle or repeat songs. Audio format recognition does not guarantee every codec can be decoded by the installed Windows WebView.

In the **Windows desktop app**, the library, playlists, playback preferences, and durable artwork references are saved to the app's local AppData storage, with a localStorage backup for recovery. The app stores file paths and metadata rather than copying your music into its database; the original audio files must remain available at those paths. If a source file is moved or deleted, its saved entry may no longer be playable until you locate or re-import it.

In the **browser build**, playback depends on the browser session's access to imported files. Temporary browser object URLs are not durable across restarts, so re-import files when needed. Music is not uploaded to a server. There is no backend, cloud sync, or account system.

Some audio extensions may be recognized but cannot play if the WebView/browser lacks a suitable decoder. Before publishing a Windows release, complete the [Windows release QA checklist](docs/RELEASE_CHECKLIST.md); CI builds are not a substitute for installing and smoke-testing the generated installer on a clean Windows machine.

## Contributing

Please work on a feature branch and submit a focused pull request to the upstream project. Run `npm test`, `npm run lint`, and `npm run build` before proposing changes. Test keyboard and pointer operation when modifying playback UI.

The elastic volume control is an adaptation of the [React Bits Elastic Slider](https://reactbits.dev/components/elastic-slider), implemented with the existing Framer Motion dependency and a native accessible range input.

## Downloads (desktop app)

Resonance uses [yt-dlp](https://github.com/yt-dlp/yt-dlp) to save audio into your Music folder.

- **Progress and cancel:** each download shows live progress and can be cancelled at any time. Cancelling stops yt-dlp and ffmpeg and leaves no partial files in your Music folder.
- **First-run setup:** if yt-dlp is not on your `PATH`, Resonance downloads a private copy into its app-data folder and checks its SHA-256 checksum against the one published with the release before using it.
- **Audio conversion (MP3, M4A, Opus, FLAC, WAV):** needs ffmpeg. If it is not on your `PATH`, Resonance downloads a checksum-verified private copy the first time you convert (about a 200 MB download (roughly 340 MB installed), one time). "Best available audio" needs no conversion.
- **Stays current:** the private yt-dlp copy checks for a newer release at most once a week. A yt-dlp you installed yourself is never modified.

## Library maintenance

- Rescanning your music folder removes library entries whose files were deleted or moved out of that folder (your audio files are never touched). Nothing is removed if the scan hit errors or found no files, so an unplugged drive can't empty your library.
- Cover images are copied into app data only when they are new or changed, and cached covers nothing uses any more are cleaned up after 30 days.
