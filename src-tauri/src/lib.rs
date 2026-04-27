//! Tauri application entry point for Speaker Design Tool.
//!
//! The app is a thin native shell around the Vue/Vite frontend. All business
//! logic lives in TypeScript — this module only wires up plugins (currently
//! just `tauri-plugin-fs` for persisting the database / prefs / room to disk
//! under %APPDATA%\com.speakerdesigntool.app\).

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .setup(|_app| Ok(()))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
