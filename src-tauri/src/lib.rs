mod launcher;
use launcher::{detect_java, launch_process, list_instances, save_instances};
use tauri::Manager;

#[tauri::command]
fn app_info() -> serde_json::Value { serde_json::json!({"name":"SM Launcher","version":env!("CARGO_PKG_VERSION"),"engine":"Tauri 2"}) }

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![app_info,list_instances,save_instances,detect_java,launch_process])
        .setup(|app| { if let Some(window)=app.get_webview_window("main"){ let _=window.set_title("SM Launcher"); } Ok(()) })
        .run(tauri::generate_context!()).expect("error while running SM Launcher");
}
