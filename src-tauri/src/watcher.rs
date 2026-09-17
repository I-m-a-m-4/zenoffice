use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use std::sync::mpsc::channel;
use tauri::{AppHandle, Emitter};
use tauri_plugin_notification::NotificationExt;

pub fn start_downloads_watcher(app_handle: AppHandle) {
    std::thread::spawn(move || {
        let downloads_dir = match dirs::download_dir() {
            Some(dir) => dir,
            None => {
                println!("Zeneva Watcher: Could not find Downloads directory.");
                return;
            }
        };

        let (tx, rx) = channel();
        
        let mut watcher = match RecommendedWatcher::new(tx, Config::default()) {
            Ok(w) => w,
            Err(e) => {
                println!("Zeneva Watcher: Failed to create watcher: {:?}", e);
                return;
            }
        };

        if let Err(e) = watcher.watch(&downloads_dir, RecursiveMode::NonRecursive) {
            println!("Zeneva Watcher: Failed to watch directory: {:?}", e);
            return;
        }

        println!("Zeneva Watcher: Watching {:?}", downloads_dir);

        for res in rx {
            match res {
                Ok(event) => {
                    if event.kind.is_create() {
                        for path in event.paths {
                            if let Some(ext) = path.extension() {
                                let ext_str = ext.to_string_lossy().to_lowercase();
                                if ["pdf", "docx", "xlsx", "pptx", "txt"].contains(&ext_str.as_str()) {
                                    let filename = path.file_name().unwrap_or_default().to_string_lossy().into_owned();
                                    
                                    // Send system notification
                                    let _ = app_handle.notification()
                                        .builder()
                                        .title("Zeneva Office")
                                        .body(&format!("Downloaded: {}. Open in ZenOffice?", filename))
                                        .show();
                                        
                                    // Emit event to frontend
                                    let _ = app_handle.emit("downloaded-file", path.to_string_lossy().to_string());
                                }
                            }
                        }
                    }
                },
                Err(e) => println!("Zeneva Watcher: error: {:?}", e),
            }
        }
    });
}
