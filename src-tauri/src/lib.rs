mod win_grid;

#[cfg(desktop)]
use tauri::Manager;

#[cfg(desktop)]
use tauri::{menu::{Menu, MenuItem}, tray::{TrayIconBuilder, TrayIconEvent}};

#[tauri::command]
fn calculate_secure_loyalty(amount: f64) -> u32 {
    // Mission-critical secure business logic: 1 point per 1000 of currency
    (amount / 1000.0).floor() as u32
}

#[tauri::command]
fn calculate_royalty(total_sales: f64, rate: f64) -> f64 {
    // Secure royalty calculation to prevent tampering
    total_sales * rate
}

#[tauri::command]
fn validate_subscription(access_level: String, trial_expires_at: i64) -> bool {
    if access_level == "lifetime" {
        return true;
    }
    
    let now = match std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH) {
        Ok(d) => d.as_secs() as i64,
        Err(_) => 0,
    };
        
    trial_expires_at > now
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  #[cfg(target_os = "android")]
  let _ = rustls::crypto::ring::default_provider().install_default();

  println!("Zeneva: Initializing Builder...");
  
  #[allow(unused_mut)]
  let mut builder = tauri::Builder::default()
    .plugin(tauri_plugin_log::Builder::default()
      .level(log::LevelFilter::Info)
      .build())
    .invoke_handler(tauri::generate_handler![
        calculate_secure_loyalty, 
        calculate_royalty, 
        validate_subscription,
        win_grid::list_desktop_windows,
        win_grid::read_desktop_grid
    ])
    .plugin(tauri_plugin_sql::Builder::default().build())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    // .plugin(tauri_plugin_stronghold::Builder::new(|_password| {
    //     "zeneva-secure-key-2024".as_bytes().to_vec()
    // }).build())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_shell::init());

  // Single-instance: if a second instance is launched, show the existing window
  #[cfg(desktop)]
  {
    use tauri::Manager;
    builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        println!("Zeneva: Second instance detected — focusing existing window.");
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
    }));
  }

  builder
    .setup(|app| {
        println!("Zeneva: Entering setup...");

        #[cfg(desktop)]
        {
            use tauri::Manager;
            // FIX: Explicitly show and focus the main window on startup.
            // This is the primary fix — without this, the window can start hidden.
            if let Some(window) = app.get_webview_window("main") {
                println!("Zeneva: Showing and focusing main window...");
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            } else {
                println!("Zeneva: WARNING — could not find 'main' window in setup!");
            }

            // Build tray menu
            let quit_i = MenuItem::with_id(app, "quit", "Quit Zeneva", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show Zeneva Dashboard", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            // Build tray icon (non-fatal if icon is missing)
            if let Some(tray_icon) = app.default_window_icon().cloned() {
                println!("Zeneva: Building tray icon...");
                let tray_result = TrayIconBuilder::new()
                    .icon(tray_icon)
                    .menu(&menu)
                    .on_menu_event(|app, event| {
                        match event.id.as_ref() {
                            "quit" => {
                                println!("Zeneva: Quit requested from tray.");
                                std::process::exit(0);
                            }
                            "show" => {
                                if let Some(win) = app.get_webview_window("main") {
                                    let _ = win.show();
                                    let _ = win.unminimize();
                                    let _ = win.set_focus();
                                }
                            }
                            _ => {}
                        }
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, .. } = event {
                            let app = tray.app_handle();
                            if let Some(win) = app.get_webview_window("main") {
                                let _ = win.show();
                                let _ = win.unminimize();
                                let _ = win.set_focus();
                            }
                        }
                    })
                    .build(app);

                match tray_result {
                    Ok(_) => println!("Zeneva: Tray icon built successfully."),
                    Err(e) => println!("Zeneva: WARNING — Tray icon failed to build: {:?}", e),
                }
            } else {
                println!("Zeneva: WARNING — No default window icon found, skipping tray.");
            }
        }
        
        #[cfg(mobile)]
        {
            let _ = app;
        }

        println!("Zeneva: Setup completed successfully.");
        Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
