//! Pure helpers (std only) so they can be unit-tested without the Tauri toolchain.

pub const MAX_URL_LEN: usize = 2048;
pub const PROGRESS_PREFIX: &str = "RESONANCE_PROGRESS|";
pub const ERROR_PREFIX: &str = "RESONANCE_ERROR: ";

/// Accepts only a single http(s) URL (scheme check is case-insensitive, matching the UI).
pub fn validate_url(raw: &str) -> Result<String, String> {
    let url = raw.trim();
    let lower = url.to_ascii_lowercase();
    let has_scheme = lower.starts_with("https://") || lower.starts_with("http://");
    if !has_scheme
        || url.len() > MAX_URL_LEN
        || url.chars().any(|c| c.is_control() || c.is_whitespace())
    {
        return Err("Enter a valid http:// or https:// URL.".into());
    }
    Ok(url.to_string())
}

/// Last non-empty line of a process's output, or `fallback`.
pub fn last_line(bytes: &[u8], fallback: &str) -> String {
    let text = String::from_utf8_lossy(bytes);
    text.lines()
        .rev()
        .find(|line| !line.trim().is_empty())
        .unwrap_or(fallback)
        .trim()
        .to_string()
}

/// Extracts the install script's explicit error message, avoiding PowerShell's noisy footer lines.
pub fn installer_error(bytes: &[u8], fallback: &str) -> String {
    let text = String::from_utf8_lossy(bytes);
    if let Some(reason) = text.lines().rev().find_map(|line| {
        line.trim()
            .strip_prefix(ERROR_PREFIX)
            .map(str::trim)
            .filter(|reason| !reason.is_empty())
    }) {
        return reason.to_string();
    }

    text.lines()
        .rev()
        .find(|line| {
            let line = line.trim();
            !line.is_empty() && !line.starts_with(ERROR_PREFIX)
        })
        .unwrap_or(fallback)
        .trim()
        .to_string()
}

/// Removes ANSI escape sequences (colour codes) that some yt-dlp builds add to progress text.
pub fn strip_ansi(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\u{1b}' {
            if chars.peek() == Some(&'[') {
                chars.next();
                for next in chars.by_ref() {
                    if ('@'..='~').contains(&next) {
                        break;
                    }
                }
            }
            continue;
        }
        out.push(c);
    }
    out
}

#[derive(Debug, Clone, PartialEq)]
pub struct Progress {
    /// 0.0..=100.0, or None while yt-dlp does not know the total size yet.
    pub percent: Option<f64>,
    pub speed: String,
    pub eta: String,
}

/// Parses `RESONANCE_PROGRESS|<status>|<percent>|<speed>|<eta>` (see the yt-dlp template in lib.rs).
pub fn parse_progress_line(line: &str) -> Option<Progress> {
    let clean = strip_ansi(line);
    let rest = clean.trim().strip_prefix(PROGRESS_PREFIX)?;
    let mut parts = rest.split('|').map(str::trim);
    let _status = parts.next()?;
    let percent = parts
        .next()
        .and_then(|p| p.trim_end_matches('%').trim().parse::<f64>().ok())
        .map(|p| p.clamp(0.0, 100.0));
    let clean_field = |v: Option<&str>| match v {
        Some(s) if !s.is_empty() && !s.eq_ignore_ascii_case("n/a") && !s.eq_ignore_ascii_case("unknown") => s.to_string(),
        _ => String::new(),
    };
    let speed = clean_field(parts.next());
    let eta = clean_field(parts.next());
    Some(Progress { percent, speed, eta })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn url_scheme_is_case_insensitive_and_strict() {
        assert!(validate_url("https://example.com/a?b=c").is_ok());
        assert!(validate_url("  HTTPS://Example.com/x  ").is_ok());
        assert!(validate_url("http://example.com").is_ok());
        assert!(validate_url("file:///etc/passwd").is_err());
        assert!(validate_url("ftp://example.com").is_err());
        assert!(validate_url("--exec=calc https://example.com").is_err());
        assert!(validate_url("https://exa mple.com").is_err());
        assert!(validate_url("https://example.com/\nsecond").is_err());
        assert!(validate_url(&format!("https://e.com/{}", "a".repeat(MAX_URL_LEN))).is_err());
        assert!(validate_url("").is_err());
    }

    #[test]
    fn last_line_skips_blank_lines() {
        assert_eq!(last_line(b"first\nERROR: boom\n\n  \n", "x"), "ERROR: boom");
        assert_eq!(last_line(b"\n\n", "fallback"), "fallback");
    }

    #[test]
    fn installer_error_prefers_the_explicit_reason() {
        let stderr = b"At line:1 char:5\nRESONANCE_ERROR: Checksum mismatch: the download was rejected.\n    + FullyQualifiedErrorId : Checksum mismatch\n";
        assert_eq!(
            installer_error(stderr, "fallback"),
            "Checksum mismatch: the download was rejected."
        );
        assert_eq!(installer_error(b"plain failure\n", "fallback"), "plain failure");
        assert_eq!(installer_error(b"", "fallback"), "fallback");
        assert_eq!(installer_error(b"RESONANCE_ERROR: \n", "fallback"), "fallback");
    }

    #[test]
    fn ansi_codes_are_removed() {
        assert_eq!(strip_ansi("\u{1b}[0;94m 45.3%\u{1b}[0m"), " 45.3%");
        assert_eq!(strip_ansi("plain"), "plain");
    }

    #[test]
    fn progress_lines_parse() {
        let p = parse_progress_line("RESONANCE_PROGRESS|downloading| 45.3%|1.20MiB/s|00:12").unwrap();
        assert_eq!(p, Progress { percent: Some(45.3), speed: "1.20MiB/s".into(), eta: "00:12".into() });
        let p = parse_progress_line("\u{1b}[0mRESONANCE_PROGRESS|downloading|N/A|Unknown|Unknown").unwrap();
        assert_eq!(p.percent, None);
        assert!(p.speed.is_empty() && p.eta.is_empty());
        assert_eq!(parse_progress_line("RESONANCE_PROGRESS|finished|150%|a|b").unwrap().percent, Some(100.0));
        assert!(parse_progress_line("/home/me/Music/song.mp3").is_none());
        assert!(parse_progress_line("[download] 10%").is_none());
    }
}
