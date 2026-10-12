use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::mpsc::channel;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tauri_plugin_notification::NotificationExt;

static RECENT_NOTIFICATIONS: Mutex<Option<HashMap<PathBuf, Instant>>> = Mutex::new(None);
static IGNORED_PATHS: Mutex<Option<HashMap<String, Instant>>> = Mutex::new(None);

pub fn ignore_path(path: String) {
    if let Ok(mut lock) = IGNORED_PATHS.lock() {
        let map = lock.get_or_insert_with(HashMap::new);
        map.insert(path.clone(), Instant::now());
        // Also store just the file name
        if let Some(filename) = Path::new(&path).file_name() {
            map.insert(filename.to_string_lossy().to_string(), Instant::now());
        }
    }
}

fn is_ignored(path: &Path) -> bool {
    let filename = path.file_name().unwrap_or_default().to_string_lossy().to_string();
    let path_str = path.to_string_lossy().to_string();

    if let Ok(mut lock) = IGNORED_PATHS.lock() {
        if let Some(map) = lock.as_mut() {
            let now = Instant::now();
            map.retain(|_, time| now.duration_since(*time) < Duration::from_secs(30));

            if map.contains_key(&path_str) || map.contains_key(&filename) {
                return true;
            }
        }
    }
    false
}

fn should_notify(path: &Path) -> bool {
    // 1. Must be an existing file
    if !path.is_file() {
        return false;
    }

    // 2. Ignore temporary / partial download files
    let filename = path.file_name().unwrap_or_default().to_string_lossy();
    if filename.starts_with('.') || filename.starts_with('~') || filename.starts_with("~$") {
        return false;
    }

    let ext = match path.extension() {
        Some(e) => e.to_string_lossy().to_lowercase(),
        None => return false,
    };

    if ["crdownload", "part", "tmp", "download", "opdownload", "crswap"].contains(&ext.as_str()) {
        return false;
    }

    // 3. Supported office and document formats
    let supported = [
        "pdf", "docx", "doc", "xlsx", "xls", "csv", 
        "pptx", "ppt", "txt", "md", "zip", "rar", "7z"
    ];
    if !supported.contains(&ext.as_str()) {
        return false;
    }

    // 4. Check if intentionally ignored (saved by ZenOffice itself)
    if is_ignored(path) {
        return false;
    }

    // 5. Debounce: don't notify for the same file within 6 seconds
    let now = Instant::now();
    if let Ok(mut lock) = RECENT_NOTIFICATIONS.lock() {
        let map = lock.get_or_insert_with(HashMap::new);
        map.retain(|_, time| now.duration_since(*time) < Duration::from_secs(60));

        if let Some(last_time) = map.get(path) {
            if now.duration_since(*last_time) < Duration::from_secs(6) {
                return false;
            }
        }
        map.insert(path.to_path_buf(), now);
    }

    true
}

pub fn start_downloads_watcher(app_handle: AppHandle) {
    std::thread::spawn(move || {
        let downloads_dir = match dirs::download_dir() {
            Some(dir) => dir,
            None => {
                println!("ZenOffice Watcher: Could not find Downloads directory.");
                return;
            }
        };

        let (tx, rx) = channel();
        
        let mut watcher = match RecommendedWatcher::new(tx, Config::default()) {
            Ok(w) => w,
            Err(e) => {
                println!("ZenOffice Watcher: Failed to create watcher: {:?}", e);
                return;
            }
        };

        if let Err(e) = watcher.watch(&downloads_dir, RecursiveMode::NonRecursive) {
            println!("ZenOffice Watcher: Failed to watch directory: {:?}", e);
            return;
        }

        println!("ZenOffice Watcher: Successfully watching Downloads at {:?}", downloads_dir);

        for res in rx {
            match res {
                Ok(event) => {
                    // Check for both Create and Modify (which includes Rename when browser download completes)
                    if event.kind.is_create() || event.kind.is_modify() {
                        for path in event.paths {
                            // Small delay to allow browser to release write handle
                            std::thread::sleep(Duration::from_millis(150));

                            if should_notify(&path) {
                                let filename = path.file_name().unwrap_or_default().to_string_lossy().into_owned();
                                let ext = path.extension().unwrap_or_default().to_string_lossy().to_lowercase();
                                
                                let file_size_str = if let Ok(meta) = std::fs::metadata(&path) {
                                    let bytes = meta.len();
                                    if bytes > 1024 * 1024 {
                                        format!("{:.1} MB", bytes as f64 / (1024.0 * 1024.0))
                                    } else {
                                        format!("{:.0} KB", bytes as f64 / 1024.0)
                                    }
                                } else {
                                    String::new()
                                };

                                println!("ZenOffice Watcher: New document detected: {}", filename);

                                // 1. Send native Windows OS toast notification
                                let _ = app_handle.notification()
                                    .builder()
                                    .title("ZenOffice")
                                    .body(&format!("Downloaded: {}. Open in ZenOffice?", filename))
                                    .show();

                                // 2. Emit event to frontend
                                let payload = serde_json::json!({
                                    "path": path.to_string_lossy().to_string(),
                                    "name": filename,
                                    "type": ext,
                                    "size": file_size_str,
                                });
                                let _ = app_handle.emit("downloaded-file", payload);
                            }
                        }
                    }
                },
                Err(e) => println!("ZenOffice Watcher error: {:?}", e),
            }
        }
    });
}
