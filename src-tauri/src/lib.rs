mod error;
mod filesystem;
mod markdown;
mod preferences;

use tauri::{
    Emitter,
    Manager,
    tray::TrayIconBuilder,
    menu::{Menu, MenuItem},
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .format_timestamp_secs()
        .init();

    log::info!("MiraMD starting up");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        // Single instance: if MiraMD is already running, send the file to it
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // Focus the existing window
            if let Some(window) = app.get_webview_window("main") {
                if let Err(e) = window.show() {
                    log::debug!("Failed to show window: {}", e);
                }
                if let Err(e) = window.set_focus() {
                    log::debug!("Failed to set focus: {}", e);
                }

                // If a file was passed, tell the frontend to open it
                if args.len() > 1 {
                    let file_path = &args[1];
                    let path = std::path::Path::new(file_path);
                    if path.exists() && path.is_file() && is_markdown_file(path) {
                        if let Err(e) = window.emit("open-file", file_path.clone()) {
                            log::warn!("Failed to emit open-file event: {}", e);
                        }
                    }
                }
            }
        }))
        .invoke_handler(tauri::generate_handler![
            markdown::parse_markdown,
            filesystem::read_file,
            filesystem::write_file,
            filesystem::create_file,
            filesystem::list_directory_entries,
            preferences::load_preferences,
            preferences::save_preferences,
            get_cli_file,
            debug_log,
        ])
        .setup(|app| {
            // Store CLI file path
            let args: Vec<String> = std::env::args().collect();
            let cli_file = if args.len() > 1 {
                let path = std::path::Path::new(&args[1]);
                if path.exists() && path.is_file() && is_markdown_file(path) {
                    Some(args[1].clone())
                } else {
                    None
                }
            } else {
                None
            };
            app.manage(CliFile(cli_file));

            // Build tray icon — MiraMD stays resident when window is closed
            let quit = MenuItem::with_id(app, "quit", "Quitter MiraMD", true, None::<&str>)?;
            let show = MenuItem::with_id(app, "show", "Ouvrir MiraMD", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            let mut tray_builder = TrayIconBuilder::new()
                .tooltip("MiraMD")
                .menu(&menu)
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                if let Err(e) = window.show() {
                                    log::debug!("Failed to show window: {}", e);
                                }
                                if let Err(e) = window.set_focus() {
                                    log::debug!("Failed to set focus: {}", e);
                                }
                            }
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click { .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if let Err(e) = window.show() {
                                log::debug!("Failed to show window: {}", e);
                            }
                            if let Err(e) = window.set_focus() {
                                log::debug!("Failed to set focus: {}", e);
                            }
                        }
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            } else {
                log::warn!("No default window icon found for tray");
            }
            tray_builder.build(app)?;

            // When the window is closed, hide instead of quitting (stay resident)
            let window = app.get_webview_window("main")
                .ok_or_else(|| tauri::Error::WindowNotFound)?;
            let win_clone = window.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    if let Err(e) = win_clone.hide() {
                        log::debug!("Failed to hide window: {}", e);
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            log::error!("Failed to start MiraMD: {}", e);
            eprintln!("Fatal: MiraMD failed to start: {}", e);
            std::process::exit(1);
        });
}

/// Check if a file has a recognized markdown extension
fn is_markdown_file(path: &std::path::Path) -> bool {
    matches!(
        path.extension().and_then(|e| e.to_str()).map(|e| e.to_lowercase()).as_deref(),
        Some("md" | "markdown" | "mmd" | "mdx" | "mkd")
    )
}

struct CliFile(Option<String>);

#[tauri::command]
fn get_cli_file(state: tauri::State<CliFile>) -> Option<String> {
    state.0.clone()
}

/// Frontend debug logging — only active in debug builds
#[tauri::command]
fn debug_log(message: &str) {
    #[cfg(debug_assertions)]
    log::info!("[WebView] {}", message);
    #[cfg(not(debug_assertions))]
    let _ = message;
}
