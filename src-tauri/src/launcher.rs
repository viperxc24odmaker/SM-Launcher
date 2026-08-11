use std::{fs, path::PathBuf, process::Command};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Instance { pub id:String, pub name:String, pub version:String, pub loader:String, pub game_dir:String, pub max_memory:u32 }

fn data_dir() -> PathBuf { dirs::data_dir().unwrap_or_else(|| PathBuf::from("." )).join("SM Launcher") }

#[tauri::command]
pub fn list_instances() -> Result<Vec<Instance>, String> {
    let file=data_dir().join("instances.json"); if !file.exists(){return Ok(vec![])}
    let text=fs::read_to_string(file).map_err(|e|e.to_string())?; serde_json::from_str(&text).map_err(|e|e.to_string())
}

#[tauri::command]
pub fn save_instances(instances:Vec<Instance>) -> Result<(),String> {
    let dir=data_dir(); fs::create_dir_all(&dir).map_err(|e|e.to_string())?;
    fs::write(dir.join("instances.json"),serde_json::to_vec_pretty(&instances).map_err(|e|e.to_string())?).map_err(|e|e.to_string())
}

#[tauri::command]
pub fn detect_java() -> Result<String,String> {
    let output=Command::new("java").arg("-version").output().map_err(|e|format!("Java was not found: {e}"))?;
    if output.status.success(){Ok("java".into())}else{Err("Java was found but could not be executed".into())}
}

#[tauri::command]
pub fn launch_process(java:String, args:Vec<String>, cwd:String) -> Result<(),String> {
    Command::new(java).args(args).current_dir(cwd).spawn().map(|_|()).map_err(|e|e.to_string())
}
