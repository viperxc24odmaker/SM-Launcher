use reqwest::Client;
use serde::Deserialize;
use sha1::{Digest,Sha1};
use std::{fs,path::{Path,PathBuf}};
const MANIFEST:&str="https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
#[derive(Deserialize)]struct Manifest{versions:Vec<VersionRef>}
#[derive(Deserialize)]struct VersionRef{id:String,url:String}

#[tauri::command(rename_all = "camelCase")]
pub async fn install_minecraft(version:String,game_dir:String)->Result<String,String>{
 let c=Client::new();let m=c.get(MANIFEST).send().await.map_err(|e|e.to_string())?.error_for_status().map_err(|e|e.to_string())?.json::<Manifest>().await.map_err(|e|e.to_string())?;
 let v=m.versions.into_iter().find(|x|x.id==version).ok_or("Minecraft version was not found")?;
 let meta:serde_json::Value=c.get(v.url).send().await.map_err(|e|e.to_string())?.error_for_status().map_err(|e|e.to_string())?.json().await.map_err(|e|e.to_string())?;
 let root=PathBuf::from(game_dir);fs::create_dir_all(&root).map_err(|e|e.to_string())?;let vd=root.join("versions").join(&version);fs::create_dir_all(&vd).map_err(|e|e.to_string())?;
 let d=&meta["downloads"]["client"];download(&c,d["url"].as_str().unwrap_or(""),d["sha1"].as_str().unwrap_or(""),d["size"].as_u64().unwrap_or(0),&vd.join(format!("{version}.jar"))).await?;
 for lib in meta["libraries"].as_array().cloned().unwrap_or_default(){if !allowed(&lib){continue} if let Some(a)=lib.get("downloads").and_then(|x|x.get("artifact")).and_then(|x|x.as_object()){let p=a["path"].as_str().unwrap_or("");if !p.is_empty(){download(&c,a["url"].as_str().unwrap_or(""),a["sha1"].as_str().unwrap_or(""),a["size"].as_u64().unwrap_or(0),&root.join("libraries").join(p)).await?}} if let Some(a)=lib.get("downloads").and_then(|x|x.get("classifiers")).and_then(|x|x.get("natives-windows")).and_then(|x|x.as_object()){let p=a["path"].as_str().unwrap_or("");if !p.is_empty(){download(&c,a["url"].as_str().unwrap_or(""),a["sha1"].as_str().unwrap_or(""),a["size"].as_u64().unwrap_or(0),&root.join("libraries").join(p)).await?}}}
 if let Some(ai)=meta.get("assetIndex").and_then(|x|x.as_object()){let ip=root.join("assets").join("indexes").join(format!("{}.json",ai["id"].as_str().unwrap_or(&version)));download(&c,ai["url"].as_str().unwrap_or(""),ai["sha1"].as_str().unwrap_or(""),ai["size"].as_u64().unwrap_or(0),&ip).await?;let idx:serde_json::Value=serde_json::from_slice(&fs::read(&ip).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;if let Some(objs)=idx["objects"].as_object(){for o in objs.values(){let h=o["hash"].as_str().unwrap_or("");if h.len()<2{continue}let p=root.join("assets").join("objects").join(&h[..2]).join(h);download(&c,&format!("https://resources.download.minecraft.net/{}/{}",&h[..2],h),h,o["size"].as_u64().unwrap_or(0),&p).await?}}}
 fs::write(vd.join(format!("{version}.json")),serde_json::to_vec_pretty(&meta).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;Ok(version)
}
fn allowed(x:&serde_json::Value)->bool{if let Some(r)=x.get("rules").and_then(|x|x.as_array()){let mut a=false;for z in r{if z["action"]=="allow"{a=true}if z["action"]=="disallow"&&z.get("os").and_then(|o|o.get("name")).and_then(|n|n.as_str())==Some("windows"){return false}}a}else{true}}
async fn download(c:&Client,url:&str,sha:&str,size:u64,p:&Path)->Result<(),String>{if url.is_empty(){return Err(format!("Missing download URL: {}",p.display()))}if let Some(q)=p.parent(){fs::create_dir_all(q).map_err(|e|e.to_string())?}if p.exists()&&verify(p,sha,size).map_err(|e|e.to_string())?{return Ok(())}let b=c.get(url).send().await.map_err(|e|e.to_string())?.error_for_status().map_err(|e|e.to_string())?.bytes().await.map_err(|e|e.to_string())?;if b.len()as u64!=size{return Err(format!("Size verification failed: {}",p.display()))}fs::write(p,&b).map_err(|e|e.to_string())?;if !verify(p,sha,size).map_err(|e|e.to_string())?{return Err(format!("SHA-1 verification failed: {}",p.display()))}Ok(())}
fn verify(p:&Path,s:&str,n:u64)->Result<bool,std::io::Error>{let b=fs::read(p)?;if b.len()as u64!=n{return Ok(false)}let mut h=Sha1::new();h.update(b);Ok(format!("{:x}",h.finalize())==s)}
