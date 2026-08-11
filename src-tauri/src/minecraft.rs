use reqwest::Client;
use serde::Deserialize;
use sha1::{Digest, Sha1};
use std::{fs, path::{Path, PathBuf}};

const MANIFEST: &str = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
#[derive(Deserialize)] struct Manifest { versions: Vec<VersionRef> }
#[derive(Deserialize)] struct VersionRef { id: String, url: String }
#[derive(Deserialize)] struct VersionMeta { id: String, downloads: Downloads, libraries: Vec<Library>, assetIndex: AssetIndex }
#[derive(Deserialize)] struct Downloads { client: Download }
#[derive(Deserialize)] struct Download { url: String, sha1: String, size: u64 }
#[derive(Deserialize)] struct AssetIndex { id: String, url: String, sha1: String, size: u64 }
#[derive(Deserialize)] struct Library { downloads: Option<LibraryDownloads> }
#[derive(Deserialize)] struct LibraryDownloads { artifact: Option<Artifact> }
#[derive(Deserialize)] struct Artifact { path: String, url: String, sha1: String, size: u64 }

#[tauri::command]
pub async fn install_minecraft(version: String, game_dir: String) -> Result<String, String> {
    let client = Client::new();
    let manifest = client.get(MANIFEST).send().await.map_err(|e| e.to_string())?.error_for_status().map_err(|e| e.to_string())?.json::<Manifest>().await.map_err(|e| e.to_string())?;
    let vr = manifest.versions.into_iter().find(|v| v.id == version).ok_or("Minecraft version was not found")?;
    let meta = client.get(vr.url).send().await.map_err(|e| e.to_string())?.error_for_status().map_err(|e| e.to_string())?.json::<VersionMeta>().await.map_err(|e| e.to_string())?;
    let root = PathBuf::from(game_dir);
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    let versions = root.join("versions").join(&meta.id);
    fs::create_dir_all(&versions).map_err(|e| e.to_string())?;
    download_verified(&client, &meta.downloads.client.url, &meta.downloads.client.sha1, meta.downloads.client.size, &versions.join(format!("{}.jar", meta.id))).await?;
    for lib in meta.libraries { if let Some(d) = lib.downloads { if let Some(a) = d.artifact { let target = root.join("libraries").join(&a.path); download_verified(&client, &a.url, &a.sha1, a.size, &target).await?; } } }
    let assets = root.join("assets").join("indexes");
    fs::create_dir_all(&assets).map_err(|e| e.to_string())?;
    download_verified(&client, &meta.assetIndex.url, &meta.assetIndex.sha1, meta.assetIndex.size, &assets.join(format!("{}.json", meta.assetIndex.id))).await?;
    Ok(meta.id)
}

async fn download_verified(client: &Client, url: &str, sha1: &str, size: u64, path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() { fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
    if path.exists() && verify(path, sha1, size).map_err(|e| e.to_string())? { return Ok(()); }
    let bytes = client.get(url).send().await.map_err(|e| e.to_string())?.error_for_status().map_err(|e| e.to_string())?.bytes().await.map_err(|e| e.to_string())?;
    if bytes.len() as u64 != size { return Err(format!("Size verification failed: {}", path.display())); }
    fs::write(path, &bytes).map_err(|e| e.to_string())?;
    if !verify(path, sha1, size).map_err(|e| e.to_string())? { return Err(format!("SHA-1 verification failed: {}", path.display())); }
    Ok(())
}
fn verify(path: &Path, expected: &str, size: u64) -> Result<bool, std::io::Error> {
    let bytes = fs::read(path)?; if bytes.len() as u64 != size { return Ok(false); }
    let mut hash = Sha1::new(); hash.update(&bytes); Ok(format!("{:x}", hash.finalize()) == expected)
}
