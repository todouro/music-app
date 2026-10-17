mod runner;
mod util;

use serde::Serialize;
use serde_json::Value;
use std::ffi::OsStr;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{Emitter, Manager};
use tauri_plugin_fs::FsExt;
use util::{last_line, validate_url, Progress, PROGRESS_PREFIX};

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// How often the private yt-dlp copy checks for a newer release (sites change; old builds break).
const UPDATE_CHECK_INTERVAL: Duration = Duration::from_secs(7 * 24 * 60 * 60);
const UPDATE_MARKER: &str = "yt-dlp.update-check";

// Serialises tool installs/updates so two simultaneous commands never race on the same files.
static INSTALL_LOCK: Mutex<()> = Mutex::new(());

// Downloads yt-dlp and refuses to install it unless its SHA-256 matches the checksum file
// published with the same release. The output path is passed through an environment
// variable (never interpolated into the script) so odd characters in a path cannot alter it.
const INSTALL_SCRIPT: &str = r#"$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
$out=$env:RESONANCE_YTDLP_OUT; $tmp=$out+'.download'
try {
  # Read the release asset's published digest from GitHub's API instead of parsing a
  # separate checksum download, which can occasionally return an HTML error page.
  $asset=$null
  for ($attempt=1; $attempt -le 3; $attempt++) {
    try {
      $release=Invoke-RestMethod -UseBasicParsing -Uri 'https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest' -Headers @{ Accept='application/vnd.github+json'; 'User-Agent'='Resonance' }
      $asset=$release.assets | Where-Object { $_.name -eq 'yt-dlp.exe' } | Select-Object -First 1
      if ($asset) { break }
    } catch {
      if ($attempt -eq 3) { throw }
    }
    if ($attempt -lt 3) { Start-Sleep -Seconds 2 }
  }
  if (-not $asset) { throw 'GitHub did not return valid release metadata for yt-dlp.exe after 3 attempts.' }
  $digest=[string]$asset.digest
  if ($digest -notmatch '^sha256:[0-9a-fA-F]{64}

// Same idea for ffmpeg (needed by yt-dlp for MP3/M4A/Opus/FLAC/WAV conversion): the zip is
// verified against the checksum list published with the release before anything is unpacked.
const FFMPEG_INSTALL_SCRIPT: &str = r#"$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
Add-Type -AssemblyName System.IO.Compression.FileSystem
$name='ffmpeg-master-latest-win64-gpl.zip'
$dest=$env:RESONANCE_FFMPEG_DIR; $work=$dest+'.work'
if (Test-Path -LiteralPath $work) { Remove-Item -Recurse -Force -LiteralPath $work }
New-Item -ItemType Directory -Force -Path $work | Out-Null
try {
  # Use the release asset digest exposed by GitHub's API; don't rely on a second
  # downloadable checksum file that may be replaced by an HTML error response.
  $release=Invoke-RestMethod -UseBasicParsing -Uri 'https://api.github.com/repos/yt-dlp/FFmpeg-Builds/releases/latest' -Headers @{ Accept='application/vnd.github+json'; 'User-Agent'='Resonance' }
  $asset=$release.assets | Where-Object { $_.name -eq $name } | Select-Object -First 1
  if (-not $asset) { throw 'Could not find the ffmpeg archive in GitHub release metadata.' }
  $digest=[string]$asset.digest
  if ($digest -notmatch '^sha256:[0-9a-fA-F]{64}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DownloadProgress {
    /// "preparing" while tools are installed/updated, "downloading" while yt-dlp reports progress.
    stage: &'static str,
    percent: Option<f64>,
    speed: String,
    eta: String,
    message: String,
}

fn emit_progress(app: &tauri::AppHandle, stage: &'static str, message: &str, progress: Option<&Progress>) {
    let payload = DownloadProgress {
        stage,
        percent: progress.and_then(|p| p.percent),
        speed: progress.map(|p| p.speed.clone()).unwrap_or_default(),
        eta: progress.map(|p| p.eta.clone()).unwrap_or_default(),
        message: message.to_string(),
    };
    let _ = app.emit("download-progress", payload);
}

/// Builds a Command that never flashes a console window on Windows.
fn new_command<S: AsRef<OsStr>>(program: S) -> Command {
    #[allow(unused_mut)]
    let mut command = Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    command
}

fn command_works<S: AsRef<OsStr>>(program: S) -> bool {
    new_command(program)
        .arg("-version")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn tools_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data = app.path().app_data_dir()
        .map_err(|error| format!("Could not locate Resonance's app data folder: {error}"))?;
    let tools = app_data.join("tools");
    fs::create_dir_all(&tools)
        .map_err(|error| format!("Could not prepare the downloader folder: {error}"))?;
    Ok(tools)
}

/// Checks (at most weekly) for a newer yt-dlp. Only used for Resonance's private copy; a
/// yt-dlp the user installed themselves is never modified. Best effort: failures are ignored.
fn maybe_update_yt_dlp(executable: &Path, tools: &Path) {
    let marker = tools.join(UPDATE_MARKER);
    let due = fs::metadata(&marker)
        .and_then(|meta| meta.modified())
        .ok()
        .and_then(|modified| modified.elapsed().ok())
        .map(|age| age > UPDATE_CHECK_INTERVAL)
        .unwrap_or(true);
    if !due {
        return;
    }
    // Write the marker first so being offline doesn't retry on every single download.
    let _ = fs::write(&marker, b"");
    let _ = new_command(executable).arg("-U").output();
}

fn yt_dlp_executable(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    // Prefer a normal installation if the user already has yt-dlp on PATH.
    if new_command("yt-dlp").arg("--version").output().map(|o| o.status.success()).unwrap_or(false) {
        return Ok(PathBuf::from("yt-dlp"));
    }

    // Otherwise, keep a private copy in Resonance's app data directory and
    // install it automatically on first use.
    let tools = tools_dir(app)?;
    let executable = tools.join("yt-dlp.exe");
    if executable.is_file() {
        if let Ok(_guard) = INSTALL_LOCK.lock() {
            maybe_update_yt_dlp(&executable, &tools);
        }
        return Ok(executable);
    }

    let _guard = INSTALL_LOCK.lock().map_err(|_| "The downloader installer is unavailable.".to_string())?;
    if executable.is_file() {
        return Ok(executable); // another command finished the install while we waited
    }

    emit_progress(app, "preparing", "Setting up the downloader (one-time)…", None);
    let result = new_command("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", INSTALL_SCRIPT])
        .env("RESONANCE_YTDLP_OUT", &executable)
        .output()
        .map_err(|error| format!("Resonance could not download yt-dlp automatically: {error}. Check your internet connection and try again."))?;

    if !result.status.success() || !executable.is_file() {
        let _ = fs::remove_file(&executable);
        let detail = last_line(&result.stderr, "The download did not complete.");
        return Err(format!("Resonance could not install yt-dlp automatically: {detail} Check your internet connection and try again."));
    }

    let _ = fs::write(tools.join(UPDATE_MARKER), b""); // freshly installed = up to date
    Ok(executable)
}

/// Returns the folder to pass to `--ffmpeg-location`, or None when ffmpeg is already on PATH.
/// Installs a verified private copy the first time a format conversion is requested.
fn ffmpeg_location(app: &tauri::AppHandle) -> Result<Option<PathBuf>, String> {
    if command_works("ffmpeg") && command_works("ffprobe") {
        return Ok(None);
    }

    let dir = tools_dir(app)?.join("ffmpeg");
    let ready = |path: &Path| path.join("ffmpeg.exe").is_file() && path.join("ffprobe.exe").is_file();
    if ready(&dir) {
        return Ok(Some(dir));
    }

    let _guard = INSTALL_LOCK.lock().map_err(|_| "The ffmpeg installer is unavailable.".to_string())?;
    if ready(&dir) {
        return Ok(Some(dir));
    }

    emit_progress(
        app,
        "preparing",
        "Setting up audio conversion (one-time download, about 100 MB)…",
        None,
    );
    let result = new_command("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", FFMPEG_INSTALL_SCRIPT])
        .env("RESONANCE_FFMPEG_DIR", &dir)
        .output()
        .map_err(|error| format!("Resonance could not download ffmpeg automatically: {error}."))?;

    if !result.status.success() || !ready(&dir) {
        let _ = fs::remove_dir_all(&dir);
        let detail = last_line(&result.stderr, "The download did not complete.");
        return Err(format!(
            "Resonance could not set up audio conversion: {detail} Check your connection, or choose \"Best available audio\", which needs no conversion."
        ));
    }
    Ok(Some(dir))
}

fn run_download(app: tauri::AppHandle, url: String, output_path: PathBuf, format: String) -> Result<String, String> {
    emit_progress(&app, "preparing", "Preparing…", None);
    let executable = yt_dlp_executable(&app)?;
    let ffmpeg = if format == "best" { None } else { ffmpeg_location(&app)? };

    // Partial files go to a private temp folder, never into the user's Music folder, so a
    // cancelled or failed download leaves nothing behind there.
    let temp_dir = tools_dir(&app)?.join("tmp");
    let _ = fs::remove_dir_all(&temp_dir);
    fs::create_dir_all(&temp_dir).map_err(|error| format!("Could not prepare a temporary folder: {error}"))?;

    let mut command = new_command(executable);
    command
        .arg("--no-warnings")
        .arg("--no-playlist")
        .arg("--newline")
        .arg("--progress")
        .arg("--progress-template")
        .arg(format!(
            "download:{PROGRESS_PREFIX}%(progress.status)s|%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s"
        ))
        .arg("--socket-timeout")
        .arg("30")
        .arg("--print")
        .arg("after_move:filepath")
        .arg("-P")
        .arg(&output_path)
        .arg("-P")
        .arg(format!("temp:{}", temp_dir.display()))
        .arg("-o")
        .arg("%(title)s.%(ext)s")
        .arg("-f")
        .arg("bestaudio/best");

    if format != "best" {
        command
            .arg("-x")
            .arg("--audio-format")
            .arg(&format)
            .arg("--audio-quality")
            .arg("0")
            .arg("--embed-metadata");
        if let Some(dir) = &ffmpeg {
            command.arg("--ffmpeg-location").arg(dir);
        }
    }

    // `--` guarantees the URL can never be parsed as an option.
    command.arg("--").arg(&url);

    let handle = app.clone();
    let on_progress: runner::ProgressCallback =
        Arc::new(move |progress| emit_progress(&handle, "downloading", "", Some(&progress)));
    let output = runner::run_with_progress(command, on_progress)
        .map_err(|error| format!("Could not start yt-dlp: {error}"));
    let _ = fs::remove_dir_all(&temp_dir);
    let output = output?;

    if output.cancelled {
        return Err("Download cancelled.".into());
    }
    if !output.success {
        let detail = output
            .stderr
            .iter()
            .rev()
            .find(|line| !line.trim().is_empty())
            .map(|line| line.trim().to_string())
            .unwrap_or_else(|| "yt-dlp could not download this URL.".to_string());
        return Err(format!("Download failed: {detail}"));
    }

    let saved_path = output
        .stdout
        .iter()
        .rev()
        .map(|line| line.trim())
        .find(|line| !line.is_empty() && Path::new(line).is_absolute())
        .unwrap_or("");

    if saved_path.is_empty() {
        return Err("yt-dlp finished, but Resonance could not identify the saved file path.".into());
    }
    Ok(saved_path.to_string())
}

// These commands are `async` and do their blocking work on a worker thread. Synchronous
// Tauri commands run on the main thread, which froze the whole window during downloads.
#[tauri::command]
async fn download_audio(
    app: tauri::AppHandle,
    url: String,
    output_dir: String,
    format: String,
) -> Result<String, String> {
    let url = validate_url(&url)?;

    let output_path = PathBuf::from(&output_dir);
    if !output_path.is_dir() {
        return Err("Your selected Music folder is unavailable. Choose the folder again in Resonance.".into());
    }
    // Only save into folders the user granted through the folder picker (or AppData), so a
    // compromised web view cannot use this command to write files anywhere on disk.
    if !app.fs_scope().is_allowed(&output_path) {
        return Err("Resonance doesn't have access to that folder. Choose your Music folder again.".into());
    }

    let allowed_formats = ["best", "mp3", "m4a", "opus", "flac", "wav"];
    if !allowed_formats.contains(&format.as_str()) {
        return Err("That audio format is not supported.".into());
    }

    tauri::async_runtime::spawn_blocking(move || run_download(app, url, output_path, format))
        .await
        .map_err(|error| format!("The download task stopped unexpectedly: {error}"))?
}

/// Stops the download that is currently running (including ffmpeg and other child processes).
#[tauri::command]
async fn cancel_download() -> bool {
    tauri::async_runtime::spawn_blocking(runner::cancel_active)
        .await
        .unwrap_or(false)
}

fn run_inspect(app: tauri::AppHandle, url: String) -> Result<String, String> {
    let executable = yt_dlp_executable(&app)?;
    let result = new_command(executable)
        .arg("--dump-single-json")
        .arg("--no-warnings")
        .arg("--no-playlist")
        .arg("--skip-download")
        .arg("--socket-timeout")
        .arg("30")
        .arg("--")
        .arg(&url)
        .output()
        .map_err(|error| format!("Could not start yt-dlp: {error}"))?;

    if !result.status.success() {
        return Err(last_line(&result.stderr, "Could not inspect this media URL."));
    }

    let data: Value = serde_json::from_slice(&result.stdout)
        .map_err(|_| "yt-dlp returned invalid media information.".to_string())?;
    let title = data.get("title").and_then(Value::as_str).unwrap_or("Audio download");
    let duration = data.get("duration").and_then(Value::as_f64).unwrap_or(0.0);
    Ok(serde_json::json!({ "title": title, "duration": duration }).to_string())
}

#[tauri::command]
async fn inspect_media_url(app: tauri::AppHandle, url: String) -> Result<String, String> {
    let url = validate_url(&url)?;
    tauri::async_runtime::spawn_blocking(move || run_inspect(app, url))
        .await
        .map_err(|error| format!("The inspection task stopped unexpectedly: {error}"))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .invoke_handler(tauri::generate_handler![download_audio, inspect_media_url, cancel_download])
        .run(tauri::generate_context!())
        .expect("error while running Resonance native music player");
}
) { throw 'GitHub did not provide a valid SHA-256 digest for yt-dlp.exe; refusing to install an unverified download.' }
  $expected=$digest.Substring(7).ToLowerInvariant()
  $downloadUrl=[string]$asset.browser_download_url
  if ($downloadUrl -notmatch '^https://github\.com/yt-dlp/yt-dlp/releases/download/') { throw 'GitHub returned an unexpected yt-dlp download URL; refusing to continue.' }

  $verified=$false
  for ($attempt=1; $attempt -le 3; $attempt++) {
    try {
      if (Test-Path -LiteralPath $tmp) { Remove-Item -Force -LiteralPath $tmp }
      Invoke-WebRequest -UseBasicParsing -Uri $downloadUrl -OutFile $tmp
      $actual=(Get-FileHash -Algorithm SHA256 -LiteralPath $tmp).Hash.ToLowerInvariant()
      if ($actual -eq $expected) { $verified=$true; break }
    } catch {
      if ($attempt -eq 3) { throw }
    }
    if ($attempt -lt 3) { Start-Sleep -Seconds 2 }
  }
  if (-not $verified) { throw 'The downloaded yt-dlp file failed SHA-256 verification after 3 attempts; the download was rejected.' }
  Move-Item -Force -LiteralPath $tmp -Destination $out
} finally { if (Test-Path -LiteralPath $tmp) { Remove-Item -Force -LiteralPath $tmp } }"#;

// Same idea for ffmpeg (needed by yt-dlp for MP3/M4A/Opus/FLAC/WAV conversion): the zip is
// verified against the checksum list published with the release before anything is unpacked.
const FFMPEG_INSTALL_SCRIPT: &str = r#"$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
Add-Type -AssemblyName System.IO.Compression.FileSystem
$base='https://github.com/yt-dlp/FFmpeg-Builds/releases/latest/download/'
$name='ffmpeg-master-latest-win64-gpl.zip'
$dest=$env:RESONANCE_FFMPEG_DIR; $work=$dest+'.work'
if (Test-Path -LiteralPath $work) { Remove-Item -Recurse -Force -LiteralPath $work }
New-Item -ItemType Directory -Force -Path $work | Out-Null
try {
  $zip=Join-Path $work $name
  Invoke-WebRequest -UseBasicParsing -Uri ($base+$name) -OutFile $zip
  $sums=(Invoke-WebRequest -UseBasicParsing -Uri ($base+'checksums.sha256')).Content
  $line=($sums -split "`n" | Where-Object { $_ -match ('^[0-9a-fA-F]{64}\s+\*?'+[regex]::Escape($name)+'\s*$') } | Select-Object -First 1)
  if (-not $line) { throw 'Could not find the published ffmpeg checksum.' }
  $expected=($line.Trim() -split '\s+')[0].ToLower()
  $actual=(Get-FileHash -Algorithm SHA256 -LiteralPath $zip).Hash.ToLower()
  if ($expected -ne $actual) { throw 'Checksum mismatch: the ffmpeg download was rejected.' }
  $unzipped=Join-Path $work 'unzipped'
  [IO.Compression.ZipFile]::ExtractToDirectory($zip, $unzipped)
  $ffmpeg=Get-ChildItem -Path $unzipped -Recurse -Filter ffmpeg.exe | Select-Object -First 1
  if (-not $ffmpeg) { throw 'ffmpeg.exe was not found in the download.' }
  $ffprobe=Join-Path $ffmpeg.DirectoryName 'ffprobe.exe'
  if (-not (Test-Path -LiteralPath $ffprobe)) { throw 'ffprobe.exe was not found in the download.' }
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  Copy-Item -Force -LiteralPath $ffmpeg.FullName -Destination (Join-Path $dest 'ffmpeg.exe')
  Copy-Item -Force -LiteralPath $ffprobe -Destination (Join-Path $dest 'ffprobe.exe')
} finally { if (Test-Path -LiteralPath $work) { Remove-Item -Recurse -Force -LiteralPath $work } }"#;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DownloadProgress {
    /// "preparing" while tools are installed/updated, "downloading" while yt-dlp reports progress.
    stage: &'static str,
    percent: Option<f64>,
    speed: String,
    eta: String,
    message: String,
}

fn emit_progress(app: &tauri::AppHandle, stage: &'static str, message: &str, progress: Option<&Progress>) {
    let payload = DownloadProgress {
        stage,
        percent: progress.and_then(|p| p.percent),
        speed: progress.map(|p| p.speed.clone()).unwrap_or_default(),
        eta: progress.map(|p| p.eta.clone()).unwrap_or_default(),
        message: message.to_string(),
    };
    let _ = app.emit("download-progress", payload);
}

/// Builds a Command that never flashes a console window on Windows.
fn new_command<S: AsRef<OsStr>>(program: S) -> Command {
    #[allow(unused_mut)]
    let mut command = Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    command
}

fn command_works<S: AsRef<OsStr>>(program: S) -> bool {
    new_command(program)
        .arg("-version")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn tools_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data = app.path().app_data_dir()
        .map_err(|error| format!("Could not locate Resonance's app data folder: {error}"))?;
    let tools = app_data.join("tools");
    fs::create_dir_all(&tools)
        .map_err(|error| format!("Could not prepare the downloader folder: {error}"))?;
    Ok(tools)
}

/// Checks (at most weekly) for a newer yt-dlp. Only used for Resonance's private copy; a
/// yt-dlp the user installed themselves is never modified. Best effort: failures are ignored.
fn maybe_update_yt_dlp(executable: &Path, tools: &Path) {
    let marker = tools.join(UPDATE_MARKER);
    let due = fs::metadata(&marker)
        .and_then(|meta| meta.modified())
        .ok()
        .and_then(|modified| modified.elapsed().ok())
        .map(|age| age > UPDATE_CHECK_INTERVAL)
        .unwrap_or(true);
    if !due {
        return;
    }
    // Write the marker first so being offline doesn't retry on every single download.
    let _ = fs::write(&marker, b"");
    let _ = new_command(executable).arg("-U").output();
}

fn yt_dlp_executable(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    // Prefer a normal installation if the user already has yt-dlp on PATH.
    if new_command("yt-dlp").arg("--version").output().map(|o| o.status.success()).unwrap_or(false) {
        return Ok(PathBuf::from("yt-dlp"));
    }

    // Otherwise, keep a private copy in Resonance's app data directory and
    // install it automatically on first use.
    let tools = tools_dir(app)?;
    let executable = tools.join("yt-dlp.exe");
    if executable.is_file() {
        if let Ok(_guard) = INSTALL_LOCK.lock() {
            maybe_update_yt_dlp(&executable, &tools);
        }
        return Ok(executable);
    }

    let _guard = INSTALL_LOCK.lock().map_err(|_| "The downloader installer is unavailable.".to_string())?;
    if executable.is_file() {
        return Ok(executable); // another command finished the install while we waited
    }

    emit_progress(app, "preparing", "Setting up the downloader (one-time)…", None);
    let result = new_command("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", INSTALL_SCRIPT])
        .env("RESONANCE_YTDLP_OUT", &executable)
        .output()
        .map_err(|error| format!("Resonance could not download yt-dlp automatically: {error}. Check your internet connection and try again."))?;

    if !result.status.success() || !executable.is_file() {
        let _ = fs::remove_file(&executable);
        let detail = last_line(&result.stderr, "The download did not complete.");
        return Err(format!("Resonance could not install yt-dlp automatically: {detail} Check your internet connection and try again."));
    }

    let _ = fs::write(tools.join(UPDATE_MARKER), b""); // freshly installed = up to date
    Ok(executable)
}

/// Returns the folder to pass to `--ffmpeg-location`, or None when ffmpeg is already on PATH.
/// Installs a verified private copy the first time a format conversion is requested.
fn ffmpeg_location(app: &tauri::AppHandle) -> Result<Option<PathBuf>, String> {
    if command_works("ffmpeg") && command_works("ffprobe") {
        return Ok(None);
    }

    let dir = tools_dir(app)?.join("ffmpeg");
    let ready = |path: &Path| path.join("ffmpeg.exe").is_file() && path.join("ffprobe.exe").is_file();
    if ready(&dir) {
        return Ok(Some(dir));
    }

    let _guard = INSTALL_LOCK.lock().map_err(|_| "The ffmpeg installer is unavailable.".to_string())?;
    if ready(&dir) {
        return Ok(Some(dir));
    }

    emit_progress(
        app,
        "preparing",
        "Setting up audio conversion (one-time download, about 100 MB)…",
        None,
    );
    let result = new_command("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", FFMPEG_INSTALL_SCRIPT])
        .env("RESONANCE_FFMPEG_DIR", &dir)
        .output()
        .map_err(|error| format!("Resonance could not download ffmpeg automatically: {error}."))?;

    if !result.status.success() || !ready(&dir) {
        let _ = fs::remove_dir_all(&dir);
        let detail = last_line(&result.stderr, "The download did not complete.");
        return Err(format!(
            "Resonance could not set up audio conversion: {detail} Check your connection, or choose \"Best available audio\", which needs no conversion."
        ));
    }
    Ok(Some(dir))
}

fn run_download(app: tauri::AppHandle, url: String, output_path: PathBuf, format: String) -> Result<String, String> {
    emit_progress(&app, "preparing", "Preparing…", None);
    let executable = yt_dlp_executable(&app)?;
    let ffmpeg = if format == "best" { None } else { ffmpeg_location(&app)? };

    // Partial files go to a private temp folder, never into the user's Music folder, so a
    // cancelled or failed download leaves nothing behind there.
    let temp_dir = tools_dir(&app)?.join("tmp");
    let _ = fs::remove_dir_all(&temp_dir);
    fs::create_dir_all(&temp_dir).map_err(|error| format!("Could not prepare a temporary folder: {error}"))?;

    let mut command = new_command(executable);
    command
        .arg("--no-warnings")
        .arg("--no-playlist")
        .arg("--newline")
        .arg("--progress")
        .arg("--progress-template")
        .arg(format!(
            "download:{PROGRESS_PREFIX}%(progress.status)s|%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s"
        ))
        .arg("--socket-timeout")
        .arg("30")
        .arg("--print")
        .arg("after_move:filepath")
        .arg("-P")
        .arg(&output_path)
        .arg("-P")
        .arg(format!("temp:{}", temp_dir.display()))
        .arg("-o")
        .arg("%(title)s.%(ext)s")
        .arg("-f")
        .arg("bestaudio/best");

    if format != "best" {
        command
            .arg("-x")
            .arg("--audio-format")
            .arg(&format)
            .arg("--audio-quality")
            .arg("0")
            .arg("--embed-metadata");
        if let Some(dir) = &ffmpeg {
            command.arg("--ffmpeg-location").arg(dir);
        }
    }

    // `--` guarantees the URL can never be parsed as an option.
    command.arg("--").arg(&url);

    let handle = app.clone();
    let on_progress: runner::ProgressCallback =
        Arc::new(move |progress| emit_progress(&handle, "downloading", "", Some(&progress)));
    let output = runner::run_with_progress(command, on_progress)
        .map_err(|error| format!("Could not start yt-dlp: {error}"));
    let _ = fs::remove_dir_all(&temp_dir);
    let output = output?;

    if output.cancelled {
        return Err("Download cancelled.".into());
    }
    if !output.success {
        let detail = output
            .stderr
            .iter()
            .rev()
            .find(|line| !line.trim().is_empty())
            .map(|line| line.trim().to_string())
            .unwrap_or_else(|| "yt-dlp could not download this URL.".to_string());
        return Err(format!("Download failed: {detail}"));
    }

    let saved_path = output
        .stdout
        .iter()
        .rev()
        .map(|line| line.trim())
        .find(|line| !line.is_empty() && Path::new(line).is_absolute())
        .unwrap_or("");

    if saved_path.is_empty() {
        return Err("yt-dlp finished, but Resonance could not identify the saved file path.".into());
    }
    Ok(saved_path.to_string())
}

// These commands are `async` and do their blocking work on a worker thread. Synchronous
// Tauri commands run on the main thread, which froze the whole window during downloads.
#[tauri::command]
async fn download_audio(
    app: tauri::AppHandle,
    url: String,
    output_dir: String,
    format: String,
) -> Result<String, String> {
    let url = validate_url(&url)?;

    let output_path = PathBuf::from(&output_dir);
    if !output_path.is_dir() {
        return Err("Your selected Music folder is unavailable. Choose the folder again in Resonance.".into());
    }
    // Only save into folders the user granted through the folder picker (or AppData), so a
    // compromised web view cannot use this command to write files anywhere on disk.
    if !app.fs_scope().is_allowed(&output_path) {
        return Err("Resonance doesn't have access to that folder. Choose your Music folder again.".into());
    }

    let allowed_formats = ["best", "mp3", "m4a", "opus", "flac", "wav"];
    if !allowed_formats.contains(&format.as_str()) {
        return Err("That audio format is not supported.".into());
    }

    tauri::async_runtime::spawn_blocking(move || run_download(app, url, output_path, format))
        .await
        .map_err(|error| format!("The download task stopped unexpectedly: {error}"))?
}

/// Stops the download that is currently running (including ffmpeg and other child processes).
#[tauri::command]
async fn cancel_download() -> bool {
    tauri::async_runtime::spawn_blocking(runner::cancel_active)
        .await
        .unwrap_or(false)
}

fn run_inspect(app: tauri::AppHandle, url: String) -> Result<String, String> {
    let executable = yt_dlp_executable(&app)?;
    let result = new_command(executable)
        .arg("--dump-single-json")
        .arg("--no-warnings")
        .arg("--no-playlist")
        .arg("--skip-download")
        .arg("--socket-timeout")
        .arg("30")
        .arg("--")
        .arg(&url)
        .output()
        .map_err(|error| format!("Could not start yt-dlp: {error}"))?;

    if !result.status.success() {
        return Err(last_line(&result.stderr, "Could not inspect this media URL."));
    }

    let data: Value = serde_json::from_slice(&result.stdout)
        .map_err(|_| "yt-dlp returned invalid media information.".to_string())?;
    let title = data.get("title").and_then(Value::as_str).unwrap_or("Audio download");
    let duration = data.get("duration").and_then(Value::as_f64).unwrap_or(0.0);
    Ok(serde_json::json!({ "title": title, "duration": duration }).to_string())
}

#[tauri::command]
async fn inspect_media_url(app: tauri::AppHandle, url: String) -> Result<String, String> {
    let url = validate_url(&url)?;
    tauri::async_runtime::spawn_blocking(move || run_inspect(app, url))
        .await
        .map_err(|error| format!("The inspection task stopped unexpectedly: {error}"))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .invoke_handler(tauri::generate_handler![download_audio, inspect_media_url, cancel_download])
        .run(tauri::generate_context!())
        .expect("error while running Resonance native music player");
}
) { throw 'GitHub did not provide a valid SHA-256 digest for the ffmpeg archive; refusing to use an unverified download.' }
  $expected=$digest.Substring(7).ToLowerInvariant()
  $downloadUrl=[string]$asset.browser_download_url
  if ($downloadUrl -notmatch '^https://github\.com/yt-dlp/FFmpeg-Builds/releases/download/') { throw 'GitHub returned an unexpected ffmpeg download URL; refusing to continue.' }

  $zip=Join-Path $work $name
  Invoke-WebRequest -UseBasicParsing -Uri $downloadUrl -OutFile $zip
  $actual=(Get-FileHash -Algorithm SHA256 -LiteralPath $zip).Hash.ToLowerInvariant()
  if ($actual -ne $expected) { throw 'The downloaded ffmpeg archive failed SHA-256 verification; the download was rejected.' }

  $unzipped=Join-Path $work 'unzipped'
  [IO.Compression.ZipFile]::ExtractToDirectory($zip, $unzipped)
  $ffmpeg=Get-ChildItem -Path $unzipped -Recurse -Filter ffmpeg.exe | Select-Object -First 1
  if (-not $ffmpeg) { throw 'ffmpeg.exe was not found in the download.' }
  $ffprobe=Join-Path $ffmpeg.DirectoryName 'ffprobe.exe'
  if (-not (Test-Path -LiteralPath $ffprobe)) { throw 'ffprobe.exe was not found in the download.' }
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  Copy-Item -Force -LiteralPath $ffmpeg.FullName -Destination (Join-Path $dest 'ffmpeg.exe')
  Copy-Item -Force -LiteralPath $ffprobe -Destination (Join-Path $dest 'ffprobe.exe')
} finally { if (Test-Path -LiteralPath $work) { Remove-Item -Recurse -Force -LiteralPath $work } }"#;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DownloadProgress {
    /// "preparing" while tools are installed/updated, "downloading" while yt-dlp reports progress.
    stage: &'static str,
    percent: Option<f64>,
    speed: String,
    eta: String,
    message: String,
}

fn emit_progress(app: &tauri::AppHandle, stage: &'static str, message: &str, progress: Option<&Progress>) {
    let payload = DownloadProgress {
        stage,
        percent: progress.and_then(|p| p.percent),
        speed: progress.map(|p| p.speed.clone()).unwrap_or_default(),
        eta: progress.map(|p| p.eta.clone()).unwrap_or_default(),
        message: message.to_string(),
    };
    let _ = app.emit("download-progress", payload);
}

/// Builds a Command that never flashes a console window on Windows.
fn new_command<S: AsRef<OsStr>>(program: S) -> Command {
    #[allow(unused_mut)]
    let mut command = Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    command
}

fn command_works<S: AsRef<OsStr>>(program: S) -> bool {
    new_command(program)
        .arg("-version")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn tools_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data = app.path().app_data_dir()
        .map_err(|error| format!("Could not locate Resonance's app data folder: {error}"))?;
    let tools = app_data.join("tools");
    fs::create_dir_all(&tools)
        .map_err(|error| format!("Could not prepare the downloader folder: {error}"))?;
    Ok(tools)
}

/// Checks (at most weekly) for a newer yt-dlp. Only used for Resonance's private copy; a
/// yt-dlp the user installed themselves is never modified. Best effort: failures are ignored.
fn maybe_update_yt_dlp(executable: &Path, tools: &Path) {
    let marker = tools.join(UPDATE_MARKER);
    let due = fs::metadata(&marker)
        .and_then(|meta| meta.modified())
        .ok()
        .and_then(|modified| modified.elapsed().ok())
        .map(|age| age > UPDATE_CHECK_INTERVAL)
        .unwrap_or(true);
    if !due {
        return;
    }
    // Write the marker first so being offline doesn't retry on every single download.
    let _ = fs::write(&marker, b"");
    let _ = new_command(executable).arg("-U").output();
}

fn yt_dlp_executable(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    // Prefer a normal installation if the user already has yt-dlp on PATH.
    if new_command("yt-dlp").arg("--version").output().map(|o| o.status.success()).unwrap_or(false) {
        return Ok(PathBuf::from("yt-dlp"));
    }

    // Otherwise, keep a private copy in Resonance's app data directory and
    // install it automatically on first use.
    let tools = tools_dir(app)?;
    let executable = tools.join("yt-dlp.exe");
    if executable.is_file() {
        if let Ok(_guard) = INSTALL_LOCK.lock() {
            maybe_update_yt_dlp(&executable, &tools);
        }
        return Ok(executable);
    }

    let _guard = INSTALL_LOCK.lock().map_err(|_| "The downloader installer is unavailable.".to_string())?;
    if executable.is_file() {
        return Ok(executable); // another command finished the install while we waited
    }

    emit_progress(app, "preparing", "Setting up the downloader (one-time)…", None);
    let result = new_command("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", INSTALL_SCRIPT])
        .env("RESONANCE_YTDLP_OUT", &executable)
        .output()
        .map_err(|error| format!("Resonance could not download yt-dlp automatically: {error}. Check your internet connection and try again."))?;

    if !result.status.success() || !executable.is_file() {
        let _ = fs::remove_file(&executable);
        let detail = last_line(&result.stderr, "The download did not complete.");
        return Err(format!("Resonance could not install yt-dlp automatically: {detail} Check your internet connection and try again."));
    }

    let _ = fs::write(tools.join(UPDATE_MARKER), b""); // freshly installed = up to date
    Ok(executable)
}

/// Returns the folder to pass to `--ffmpeg-location`, or None when ffmpeg is already on PATH.
/// Installs a verified private copy the first time a format conversion is requested.
fn ffmpeg_location(app: &tauri::AppHandle) -> Result<Option<PathBuf>, String> {
    if command_works("ffmpeg") && command_works("ffprobe") {
        return Ok(None);
    }

    let dir = tools_dir(app)?.join("ffmpeg");
    let ready = |path: &Path| path.join("ffmpeg.exe").is_file() && path.join("ffprobe.exe").is_file();
    if ready(&dir) {
        return Ok(Some(dir));
    }

    let _guard = INSTALL_LOCK.lock().map_err(|_| "The ffmpeg installer is unavailable.".to_string())?;
    if ready(&dir) {
        return Ok(Some(dir));
    }

    emit_progress(
        app,
        "preparing",
        "Setting up audio conversion (one-time download, about 100 MB)…",
        None,
    );
    let result = new_command("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", FFMPEG_INSTALL_SCRIPT])
        .env("RESONANCE_FFMPEG_DIR", &dir)
        .output()
        .map_err(|error| format!("Resonance could not download ffmpeg automatically: {error}."))?;

    if !result.status.success() || !ready(&dir) {
        let _ = fs::remove_dir_all(&dir);
        let detail = last_line(&result.stderr, "The download did not complete.");
        return Err(format!(
            "Resonance could not set up audio conversion: {detail} Check your connection, or choose \"Best available audio\", which needs no conversion."
        ));
    }
    Ok(Some(dir))
}

fn run_download(app: tauri::AppHandle, url: String, output_path: PathBuf, format: String) -> Result<String, String> {
    emit_progress(&app, "preparing", "Preparing…", None);
    let executable = yt_dlp_executable(&app)?;
    let ffmpeg = if format == "best" { None } else { ffmpeg_location(&app)? };

    // Partial files go to a private temp folder, never into the user's Music folder, so a
    // cancelled or failed download leaves nothing behind there.
    let temp_dir = tools_dir(&app)?.join("tmp");
    let _ = fs::remove_dir_all(&temp_dir);
    fs::create_dir_all(&temp_dir).map_err(|error| format!("Could not prepare a temporary folder: {error}"))?;

    let mut command = new_command(executable);
    command
        .arg("--no-warnings")
        .arg("--no-playlist")
        .arg("--newline")
        .arg("--progress")
        .arg("--progress-template")
        .arg(format!(
            "download:{PROGRESS_PREFIX}%(progress.status)s|%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s"
        ))
        .arg("--socket-timeout")
        .arg("30")
        .arg("--print")
        .arg("after_move:filepath")
        .arg("-P")
        .arg(&output_path)
        .arg("-P")
        .arg(format!("temp:{}", temp_dir.display()))
        .arg("-o")
        .arg("%(title)s.%(ext)s")
        .arg("-f")
        .arg("bestaudio/best");

    if format != "best" {
        command
            .arg("-x")
            .arg("--audio-format")
            .arg(&format)
            .arg("--audio-quality")
            .arg("0")
            .arg("--embed-metadata");
        if let Some(dir) = &ffmpeg {
            command.arg("--ffmpeg-location").arg(dir);
        }
    }

    // `--` guarantees the URL can never be parsed as an option.
    command.arg("--").arg(&url);

    let handle = app.clone();
    let on_progress: runner::ProgressCallback =
        Arc::new(move |progress| emit_progress(&handle, "downloading", "", Some(&progress)));
    let output = runner::run_with_progress(command, on_progress)
        .map_err(|error| format!("Could not start yt-dlp: {error}"));
    let _ = fs::remove_dir_all(&temp_dir);
    let output = output?;

    if output.cancelled {
        return Err("Download cancelled.".into());
    }
    if !output.success {
        let detail = output
            .stderr
            .iter()
            .rev()
            .find(|line| !line.trim().is_empty())
            .map(|line| line.trim().to_string())
            .unwrap_or_else(|| "yt-dlp could not download this URL.".to_string());
        return Err(format!("Download failed: {detail}"));
    }

    let saved_path = output
        .stdout
        .iter()
        .rev()
        .map(|line| line.trim())
        .find(|line| !line.is_empty() && Path::new(line).is_absolute())
        .unwrap_or("");

    if saved_path.is_empty() {
        return Err("yt-dlp finished, but Resonance could not identify the saved file path.".into());
    }
    Ok(saved_path.to_string())
}

// These commands are `async` and do their blocking work on a worker thread. Synchronous
// Tauri commands run on the main thread, which froze the whole window during downloads.
#[tauri::command]
async fn download_audio(
    app: tauri::AppHandle,
    url: String,
    output_dir: String,
    format: String,
) -> Result<String, String> {
    let url = validate_url(&url)?;

    let output_path = PathBuf::from(&output_dir);
    if !output_path.is_dir() {
        return Err("Your selected Music folder is unavailable. Choose the folder again in Resonance.".into());
    }
    // Only save into folders the user granted through the folder picker (or AppData), so a
    // compromised web view cannot use this command to write files anywhere on disk.
    if !app.fs_scope().is_allowed(&output_path) {
        return Err("Resonance doesn't have access to that folder. Choose your Music folder again.".into());
    }

    let allowed_formats = ["best", "mp3", "m4a", "opus", "flac", "wav"];
    if !allowed_formats.contains(&format.as_str()) {
        return Err("That audio format is not supported.".into());
    }

    tauri::async_runtime::spawn_blocking(move || run_download(app, url, output_path, format))
        .await
        .map_err(|error| format!("The download task stopped unexpectedly: {error}"))?
}

/// Stops the download that is currently running (including ffmpeg and other child processes).
#[tauri::command]
async fn cancel_download() -> bool {
    tauri::async_runtime::spawn_blocking(runner::cancel_active)
        .await
        .unwrap_or(false)
}

fn run_inspect(app: tauri::AppHandle, url: String) -> Result<String, String> {
    let executable = yt_dlp_executable(&app)?;
    let result = new_command(executable)
        .arg("--dump-single-json")
        .arg("--no-warnings")
        .arg("--no-playlist")
        .arg("--skip-download")
        .arg("--socket-timeout")
        .arg("30")
        .arg("--")
        .arg(&url)
        .output()
        .map_err(|error| format!("Could not start yt-dlp: {error}"))?;

    if !result.status.success() {
        return Err(last_line(&result.stderr, "Could not inspect this media URL."));
    }

    let data: Value = serde_json::from_slice(&result.stdout)
        .map_err(|_| "yt-dlp returned invalid media information.".to_string())?;
    let title = data.get("title").and_then(Value::as_str).unwrap_or("Audio download");
    let duration = data.get("duration").and_then(Value::as_f64).unwrap_or(0.0);
    Ok(serde_json::json!({ "title": title, "duration": duration }).to_string())
}

#[tauri::command]
async fn inspect_media_url(app: tauri::AppHandle, url: String) -> Result<String, String> {
    let url = validate_url(&url)?;
    tauri::async_runtime::spawn_blocking(move || run_inspect(app, url))
        .await
        .map_err(|error| format!("The inspection task stopped unexpectedly: {error}"))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .invoke_handler(tauri::generate_handler![download_audio, inspect_media_url, cancel_download])
        .run(tauri::generate_context!())
        .expect("error while running Resonance native music player");
}
) { throw 'GitHub did not provide a valid SHA-256 digest for yt-dlp.exe; refusing to install an unverified download.' }
  $expected=$digest.Substring(7).ToLowerInvariant()
  $downloadUrl=[string]$asset.browser_download_url
  if ($downloadUrl -notmatch '^https://github\.com/yt-dlp/yt-dlp/releases/download/') { throw 'GitHub returned an unexpected yt-dlp download URL; refusing to continue.' }

  $verified=$false
  for ($attempt=1; $attempt -le 3; $attempt++) {
    try {
      if (Test-Path -LiteralPath $tmp) { Remove-Item -Force -LiteralPath $tmp }
      Invoke-WebRequest -UseBasicParsing -Uri $downloadUrl -OutFile $tmp
      $actual=(Get-FileHash -Algorithm SHA256 -LiteralPath $tmp).Hash.ToLowerInvariant()
      if ($actual -eq $expected) { $verified=$true; break }
    } catch {
      if ($attempt -eq 3) { throw }
    }
    if ($attempt -lt 3) { Start-Sleep -Seconds 2 }
  }
  if (-not $verified) { throw 'The downloaded yt-dlp file failed SHA-256 verification after 3 attempts; the download was rejected.' }
  Move-Item -Force -LiteralPath $tmp -Destination $out
} finally { if (Test-Path -LiteralPath $tmp) { Remove-Item -Force -LiteralPath $tmp } }"#;

// Same idea for ffmpeg (needed by yt-dlp for MP3/M4A/Opus/FLAC/WAV conversion): the zip is
// verified against the checksum list published with the release before anything is unpacked.
const FFMPEG_INSTALL_SCRIPT: &str = r#"$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
Add-Type -AssemblyName System.IO.Compression.FileSystem
$base='https://github.com/yt-dlp/FFmpeg-Builds/releases/latest/download/'
$name='ffmpeg-master-latest-win64-gpl.zip'
$dest=$env:RESONANCE_FFMPEG_DIR; $work=$dest+'.work'
if (Test-Path -LiteralPath $work) { Remove-Item -Recurse -Force -LiteralPath $work }
New-Item -ItemType Directory -Force -Path $work | Out-Null
try {
  $zip=Join-Path $work $name
  Invoke-WebRequest -UseBasicParsing -Uri ($base+$name) -OutFile $zip
  $sums=(Invoke-WebRequest -UseBasicParsing -Uri ($base+'checksums.sha256')).Content
  $line=($sums -split "`n" | Where-Object { $_ -match ('^[0-9a-fA-F]{64}\s+\*?'+[regex]::Escape($name)+'\s*$') } | Select-Object -First 1)
  if (-not $line) { throw 'Could not find the published ffmpeg checksum.' }
  $expected=($line.Trim() -split '\s+')[0].ToLower()
  $actual=(Get-FileHash -Algorithm SHA256 -LiteralPath $zip).Hash.ToLower()
  if ($expected -ne $actual) { throw 'Checksum mismatch: the ffmpeg download was rejected.' }
  $unzipped=Join-Path $work 'unzipped'
  [IO.Compression.ZipFile]::ExtractToDirectory($zip, $unzipped)
  $ffmpeg=Get-ChildItem -Path $unzipped -Recurse -Filter ffmpeg.exe | Select-Object -First 1
  if (-not $ffmpeg) { throw 'ffmpeg.exe was not found in the download.' }
  $ffprobe=Join-Path $ffmpeg.DirectoryName 'ffprobe.exe'
  if (-not (Test-Path -LiteralPath $ffprobe)) { throw 'ffprobe.exe was not found in the download.' }
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  Copy-Item -Force -LiteralPath $ffmpeg.FullName -Destination (Join-Path $dest 'ffmpeg.exe')
  Copy-Item -Force -LiteralPath $ffprobe -Destination (Join-Path $dest 'ffprobe.exe')
} finally { if (Test-Path -LiteralPath $work) { Remove-Item -Recurse -Force -LiteralPath $work } }"#;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DownloadProgress {
    /// "preparing" while tools are installed/updated, "downloading" while yt-dlp reports progress.
    stage: &'static str,
    percent: Option<f64>,
    speed: String,
    eta: String,
    message: String,
}

fn emit_progress(app: &tauri::AppHandle, stage: &'static str, message: &str, progress: Option<&Progress>) {
    let payload = DownloadProgress {
        stage,
        percent: progress.and_then(|p| p.percent),
        speed: progress.map(|p| p.speed.clone()).unwrap_or_default(),
        eta: progress.map(|p| p.eta.clone()).unwrap_or_default(),
        message: message.to_string(),
    };
    let _ = app.emit("download-progress", payload);
}

/// Builds a Command that never flashes a console window on Windows.
fn new_command<S: AsRef<OsStr>>(program: S) -> Command {
    #[allow(unused_mut)]
    let mut command = Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    command
}

fn command_works<S: AsRef<OsStr>>(program: S) -> bool {
    new_command(program)
        .arg("-version")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn tools_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data = app.path().app_data_dir()
        .map_err(|error| format!("Could not locate Resonance's app data folder: {error}"))?;
    let tools = app_data.join("tools");
    fs::create_dir_all(&tools)
        .map_err(|error| format!("Could not prepare the downloader folder: {error}"))?;
    Ok(tools)
}

/// Checks (at most weekly) for a newer yt-dlp. Only used for Resonance's private copy; a
/// yt-dlp the user installed themselves is never modified. Best effort: failures are ignored.
fn maybe_update_yt_dlp(executable: &Path, tools: &Path) {
    let marker = tools.join(UPDATE_MARKER);
    let due = fs::metadata(&marker)
        .and_then(|meta| meta.modified())
        .ok()
        .and_then(|modified| modified.elapsed().ok())
        .map(|age| age > UPDATE_CHECK_INTERVAL)
        .unwrap_or(true);
    if !due {
        return;
    }
    // Write the marker first so being offline doesn't retry on every single download.
    let _ = fs::write(&marker, b"");
    let _ = new_command(executable).arg("-U").output();
}

fn yt_dlp_executable(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    // Prefer a normal installation if the user already has yt-dlp on PATH.
    if new_command("yt-dlp").arg("--version").output().map(|o| o.status.success()).unwrap_or(false) {
        return Ok(PathBuf::from("yt-dlp"));
    }

    // Otherwise, keep a private copy in Resonance's app data directory and
    // install it automatically on first use.
    let tools = tools_dir(app)?;
    let executable = tools.join("yt-dlp.exe");
    if executable.is_file() {
        if let Ok(_guard) = INSTALL_LOCK.lock() {
            maybe_update_yt_dlp(&executable, &tools);
        }
        return Ok(executable);
    }

    let _guard = INSTALL_LOCK.lock().map_err(|_| "The downloader installer is unavailable.".to_string())?;
    if executable.is_file() {
        return Ok(executable); // another command finished the install while we waited
    }

    emit_progress(app, "preparing", "Setting up the downloader (one-time)…", None);
    let result = new_command("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", INSTALL_SCRIPT])
        .env("RESONANCE_YTDLP_OUT", &executable)
        .output()
        .map_err(|error| format!("Resonance could not download yt-dlp automatically: {error}. Check your internet connection and try again."))?;

    if !result.status.success() || !executable.is_file() {
        let _ = fs::remove_file(&executable);
        let detail = last_line(&result.stderr, "The download did not complete.");
        return Err(format!("Resonance could not install yt-dlp automatically: {detail} Check your internet connection and try again."));
    }

    let _ = fs::write(tools.join(UPDATE_MARKER), b""); // freshly installed = up to date
    Ok(executable)
}

/// Returns the folder to pass to `--ffmpeg-location`, or None when ffmpeg is already on PATH.
/// Installs a verified private copy the first time a format conversion is requested.
fn ffmpeg_location(app: &tauri::AppHandle) -> Result<Option<PathBuf>, String> {
    if command_works("ffmpeg") && command_works("ffprobe") {
        return Ok(None);
    }

    let dir = tools_dir(app)?.join("ffmpeg");
    let ready = |path: &Path| path.join("ffmpeg.exe").is_file() && path.join("ffprobe.exe").is_file();
    if ready(&dir) {
        return Ok(Some(dir));
    }

    let _guard = INSTALL_LOCK.lock().map_err(|_| "The ffmpeg installer is unavailable.".to_string())?;
    if ready(&dir) {
        return Ok(Some(dir));
    }

    emit_progress(
        app,
        "preparing",
        "Setting up audio conversion (one-time download, about 100 MB)…",
        None,
    );
    let result = new_command("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", FFMPEG_INSTALL_SCRIPT])
        .env("RESONANCE_FFMPEG_DIR", &dir)
        .output()
        .map_err(|error| format!("Resonance could not download ffmpeg automatically: {error}."))?;

    if !result.status.success() || !ready(&dir) {
        let _ = fs::remove_dir_all(&dir);
        let detail = last_line(&result.stderr, "The download did not complete.");
        return Err(format!(
            "Resonance could not set up audio conversion: {detail} Check your connection, or choose \"Best available audio\", which needs no conversion."
        ));
    }
    Ok(Some(dir))
}

fn run_download(app: tauri::AppHandle, url: String, output_path: PathBuf, format: String) -> Result<String, String> {
    emit_progress(&app, "preparing", "Preparing…", None);
    let executable = yt_dlp_executable(&app)?;
    let ffmpeg = if format == "best" { None } else { ffmpeg_location(&app)? };

    // Partial files go to a private temp folder, never into the user's Music folder, so a
    // cancelled or failed download leaves nothing behind there.
    let temp_dir = tools_dir(&app)?.join("tmp");
    let _ = fs::remove_dir_all(&temp_dir);
    fs::create_dir_all(&temp_dir).map_err(|error| format!("Could not prepare a temporary folder: {error}"))?;

    let mut command = new_command(executable);
    command
        .arg("--no-warnings")
        .arg("--no-playlist")
        .arg("--newline")
        .arg("--progress")
        .arg("--progress-template")
        .arg(format!(
            "download:{PROGRESS_PREFIX}%(progress.status)s|%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s"
        ))
        .arg("--socket-timeout")
        .arg("30")
        .arg("--print")
        .arg("after_move:filepath")
        .arg("-P")
        .arg(&output_path)
        .arg("-P")
        .arg(format!("temp:{}", temp_dir.display()))
        .arg("-o")
        .arg("%(title)s.%(ext)s")
        .arg("-f")
        .arg("bestaudio/best");

    if format != "best" {
        command
            .arg("-x")
            .arg("--audio-format")
            .arg(&format)
            .arg("--audio-quality")
            .arg("0")
            .arg("--embed-metadata");
        if let Some(dir) = &ffmpeg {
            command.arg("--ffmpeg-location").arg(dir);
        }
    }

    // `--` guarantees the URL can never be parsed as an option.
    command.arg("--").arg(&url);

    let handle = app.clone();
    let on_progress: runner::ProgressCallback =
        Arc::new(move |progress| emit_progress(&handle, "downloading", "", Some(&progress)));
    let output = runner::run_with_progress(command, on_progress)
        .map_err(|error| format!("Could not start yt-dlp: {error}"));
    let _ = fs::remove_dir_all(&temp_dir);
    let output = output?;

    if output.cancelled {
        return Err("Download cancelled.".into());
    }
    if !output.success {
        let detail = output
            .stderr
            .iter()
            .rev()
            .find(|line| !line.trim().is_empty())
            .map(|line| line.trim().to_string())
            .unwrap_or_else(|| "yt-dlp could not download this URL.".to_string());
        return Err(format!("Download failed: {detail}"));
    }

    let saved_path = output
        .stdout
        .iter()
        .rev()
        .map(|line| line.trim())
        .find(|line| !line.is_empty() && Path::new(line).is_absolute())
        .unwrap_or("");

    if saved_path.is_empty() {
        return Err("yt-dlp finished, but Resonance could not identify the saved file path.".into());
    }
    Ok(saved_path.to_string())
}

// These commands are `async` and do their blocking work on a worker thread. Synchronous
// Tauri commands run on the main thread, which froze the whole window during downloads.
#[tauri::command]
async fn download_audio(
    app: tauri::AppHandle,
    url: String,
    output_dir: String,
    format: String,
) -> Result<String, String> {
    let url = validate_url(&url)?;

    let output_path = PathBuf::from(&output_dir);
    if !output_path.is_dir() {
        return Err("Your selected Music folder is unavailable. Choose the folder again in Resonance.".into());
    }
    // Only save into folders the user granted through the folder picker (or AppData), so a
    // compromised web view cannot use this command to write files anywhere on disk.
    if !app.fs_scope().is_allowed(&output_path) {
        return Err("Resonance doesn't have access to that folder. Choose your Music folder again.".into());
    }

    let allowed_formats = ["best", "mp3", "m4a", "opus", "flac", "wav"];
    if !allowed_formats.contains(&format.as_str()) {
        return Err("That audio format is not supported.".into());
    }

    tauri::async_runtime::spawn_blocking(move || run_download(app, url, output_path, format))
        .await
        .map_err(|error| format!("The download task stopped unexpectedly: {error}"))?
}

/// Stops the download that is currently running (including ffmpeg and other child processes).
#[tauri::command]
async fn cancel_download() -> bool {
    tauri::async_runtime::spawn_blocking(runner::cancel_active)
        .await
        .unwrap_or(false)
}

fn run_inspect(app: tauri::AppHandle, url: String) -> Result<String, String> {
    let executable = yt_dlp_executable(&app)?;
    let result = new_command(executable)
        .arg("--dump-single-json")
        .arg("--no-warnings")
        .arg("--no-playlist")
        .arg("--skip-download")
        .arg("--socket-timeout")
        .arg("30")
        .arg("--")
        .arg(&url)
        .output()
        .map_err(|error| format!("Could not start yt-dlp: {error}"))?;

    if !result.status.success() {
        return Err(last_line(&result.stderr, "Could not inspect this media URL."));
    }

    let data: Value = serde_json::from_slice(&result.stdout)
        .map_err(|_| "yt-dlp returned invalid media information.".to_string())?;
    let title = data.get("title").and_then(Value::as_str).unwrap_or("Audio download");
    let duration = data.get("duration").and_then(Value::as_f64).unwrap_or(0.0);
    Ok(serde_json::json!({ "title": title, "duration": duration }).to_string())
}

#[tauri::command]
async fn inspect_media_url(app: tauri::AppHandle, url: String) -> Result<String, String> {
    let url = validate_url(&url)?;
    tauri::async_runtime::spawn_blocking(move || run_inspect(app, url))
        .await
        .map_err(|error| format!("The inspection task stopped unexpectedly: {error}"))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .invoke_handler(tauri::generate_handler![download_audio, inspect_media_url, cancel_download])
        .run(tauri::generate_context!())
        .expect("error while running Resonance native music player");
}
