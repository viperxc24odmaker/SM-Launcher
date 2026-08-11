use serde::{Deserialize, Serialize};
use std::{fs, path::Path};
use reqwest::Client;
use zip::ZipArchive;
use std::io::Cursor;
use sha2::{Digest, Sha512};

#[derive(Serialize, Deserialize, Clone)]
pub struct ProjectCard { pub id:String, pub title:String, pub description:String, pub icon_url:Option<String>, pub downloads:u64, pub slug:String }
#[derive(Deserialize)] struct SearchResponse { hits:Vec<SearchHit> }
#[derive(Deserialize)] struct SearchHit { project_id:String, title:String, description:String, icon_url:Option<String>, downloads:u64, slug:String }

#[tauri::command]
pub async fn modrinth_search(query:String, project_type:Option<String>) -> Result<Vec<ProjectCard>,String> {
 let client=Client::new(); let mut url=reqwest::Url::parse("https://api.modrinth.com/v2/search").map_err(|e|e.to_string())?;
 { let mut q=url.query_pairs_mut(); q.append_pair("query",&query); q.append_pair("limit","24"); if let Some(t)=project_type { q.append_pair("facets",&format!("[[\"project_type:{}\"]]",t)); } }
 let response=client.get(url).send().await.map_err(|e|e.to_string())?.error_for_status().map_err(|e|e.to_string())?;
 let data=response.json::<SearchResponse>().await.map_err(|e|e.to_string())?;
 Ok(data.hits.into_iter().map(|p|ProjectCard{id:p.project_id,title:p.title,description:p.description,icon_url:p.icon_url,downloads:p.downloads,slug:p.slug}).collect())
}

#[derive(Deserialize)] struct Version { id:String, version_number:String, files:Vec<PackFile> }
#[derive(Deserialize)] struct PackFile { url:String, filename:String, primary:bool }
#[derive(Deserialize)] struct MrpackIndex { files:Vec<IndexFile> }
#[derive(Deserialize)] struct IndexFile { path:String, hashes:std::collections::HashMap<String,String>, downloads:Vec<String>, file_size:u64 }

#[tauri::command]
pub async fn install_modpack(project:String, version_id:Option<String>, instance_dir:String) -> Result<String,String> {
 let client=Client::new(); let versions_url=format!("https://api.modrinth.com/v2/project/{}/version",project);
 let versions=client.get(versions_url).send().await.map_err(|e|e.to_string())?.error_for_status().map_err(|e|e.to_string())?.json::<Vec<Version>>().await.map_err(|e|e.to_string())?;
 let version=if let Some(id)=version_id { versions.into_iter().find(|v|v.id==id).ok_or("Requested modpack version was not found")? } else { versions.into_iter().next().ok_or("No modpack versions found")? };
 let pack=version.files.iter().find(|f|f.primary || f.filename.ends_with(".mrpack")).ok_or("No .mrpack file found")?;
 let bytes=client.get(&pack.url).send().await.map_err(|e|e.to_string())?.error_for_status().map_err(|e|e.to_string())?.bytes().await.map_err(|e|e.to_string())?;
 let target=if instance_dir.trim().is_empty(){dirs::data_dir().unwrap_or_else(||".".into()).join("SM Launcher").join("instances").join(&project)}else{instance_dir.into()};
 install_mrpack_bytes(&bytes,&target,&client).await?;
 Ok(version.version_number)
}

fn safe_target(root:&Path,relative:&str)->Result<std::path::PathBuf,String>{
 let rel=Path::new(relative); if rel.is_absolute() || rel.components().any(|c|matches!(c,std::path::Component::ParentDir)){return Err(format!("Unsafe modpack path: {relative}"));} Ok(root.join(rel))
}

async fn install_mrpack_bytes(bytes:&[u8], instance:&Path, client:&Client)->Result<(),String>{
 fs::create_dir_all(instance).map_err(|e|e.to_string())?;
 let mut archive=ZipArchive::new(Cursor::new(bytes)).map_err(|e|format!("Invalid mrpack: {e}"))?;
 let mut index_json=String::new(); { let mut f=archive.by_name("modrinth.index.json").map_err(|_|"modrinth.index.json is missing".to_string())?; use std::io::Read; f.read_to_string(&mut index_json).map_err(|e|e.to_string())?; }
 let index:MrpackIndex=serde_json::from_str(&index_json).map_err(|e|e.to_string())?;
 for entry in index.files {
  let target=safe_target(instance,&entry.path)?; if let Some(parent)=target.parent(){fs::create_dir_all(parent).map_err(|e|e.to_string())?;}
  let url=entry.downloads.first().ok_or_else(||format!("No download URL for {}",entry.path))?;
  let data=client.get(url).send().await.map_err(|e|e.to_string())?.error_for_status().map_err(|e|e.to_string())?.bytes().await.map_err(|e|e.to_string())?;
  if data.len() as u64 != entry.file_size{return Err(format!("Size verification failed for {}",entry.path));}
  if let Some(expected)=entry.hashes.get("sha512"){let actual=format!("{:x}",Sha512::digest(&data));if &actual!=expected{return Err(format!("Hash verification failed for {}",entry.path));}}
  fs::write(target,data).map_err(|e|e.to_string())?;
 }
 for i in 0..archive.len(){let mut f=archive.by_index(i).map_err(|e|e.to_string())?;let name=f.name().to_string();if !name.starts_with("overrides/")||f.is_dir(){continue}let relative=name.trim_start_matches("overrides/");let target=safe_target(instance,relative)?;if let Some(parent)=target.parent(){fs::create_dir_all(parent).map_err(|e|e.to_string())?;}let mut out=fs::File::create(target).map_err(|e|e.to_string())?;std::io::copy(&mut f,&mut out).map_err(|e|e.to_string())?;}
 Ok(())
}
