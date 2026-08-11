use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf, sync::{Mutex, OnceLock}};
use tauri::AppHandle;

const MS_CLIENT_ID: &str = "00000000402b5328";
const MS_DEVICE_URL: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode";
const MS_TOKEN_URL: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";
const XBL_USER_AUTH: &str = "https://user.auth.xboxlive.com/user/authenticate";
const XSTS_AUTH: &str = "https://xsts.auth.xboxlive.com/xsts/authorize";
const MC_LOGIN: &str = "https://api.minecraftservices.com/authentication/login_with_xbox";
const MC_PROFILE: &str = "https://api.minecraftservices.com/minecraft/profile";
const ELYBY_AUTH: &str = "https://authserver.ely.by/auth/authenticate";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account { pub id:String, pub kind:String, pub username:String, pub uuid:String, pub access_token:String }

#[derive(Debug, Deserialize)] struct DeviceCode { device_code:String, user_code:String, verification_uri:String, expires_in:u64, interval:u64, message:Option<String> }
#[derive(Debug, Deserialize)] struct MsToken { access_token:String, expires_in:u64, token_type:String }
#[derive(Debug, Deserialize)] struct XblResponse { Token:String, DisplayClaims:DisplayClaims }
#[derive(Debug, Deserialize)] struct DisplayClaims { xui:Vec<Xui> }
#[derive(Debug, Deserialize)] struct Xui { uhs:String }
#[derive(Debug, Deserialize)] struct McToken { access_token:String }
#[derive(Debug, Deserialize)] struct Profile { id:String, name:String }
#[derive(Debug, Deserialize)] struct ElyResponse { accessToken:String, selectedProfile:Option<ElyProfile> }
#[derive(Debug, Deserialize)] struct ElyProfile { id:String, name:String }

static PENDING: OnceLock<Mutex<Option<(String,u64)>>> = OnceLock::new();
fn pending()->&'static Mutex<Option<(String,u64)>> { PENDING.get_or_init(||Mutex::new(None)) }
fn store_path(app:&AppHandle)->PathBuf { app.path().app_data_dir().unwrap_or_else(|_|PathBuf::from(".")).join("accounts.json") }
fn read_accounts(app:&AppHandle)->Vec<Account>{fs::read_to_string(store_path(app)).ok().and_then(|s|serde_json::from_str(&s).ok()).unwrap_or_default()}
fn write_accounts(app:&AppHandle, accounts:&[Account])->Result<(),String>{let p=store_path(app);if let Some(d)=p.parent(){fs::create_dir_all(d).map_err(|e|e.to_string())?}fs::write(p,serde_json::to_vec_pretty(accounts).map_err(|e|e.to_string())?).map_err(|e|e.to_string())}

#[tauri::command]
pub fn accounts_list(app:AppHandle)->Vec<Account>{read_accounts(&app).into_iter().map(|mut a|{a.access_token=String::new();a}).collect()}

#[tauri::command]
pub fn account_offline(app:AppHandle, username:String)->Result<Account,String>{let username=username.trim().to_string();if !matches!(username.len(),3..=16)||!username.chars().all(|c|c.is_ascii_alphanumeric()||c=='_'){return Err("Offline username must be 3-16 letters, numbers or underscores.".into())}let a=Account{id:format!("offline-{}",username.to_lowercase()),kind:"offline".into(),username:username.clone(),uuid:format!("00000000-0000-0000-0000-{:012}",simple_id(&username)),access_token:"0".into()};let mut all=read_accounts(&app);all.retain(|x|x.id!=a.id);all.push(a.clone());write_accounts(&app,&all)?;Ok(a)}

fn simple_id(s:&str)->String{let mut h:u64=1469598103934665603;for b in s.as_bytes(){h^=*b as u64;h=h.wrapping_mul(1099511628211)}format!("{:012x}",h&0xffffffffffff)}

#[tauri::command]
pub async fn microsoft_start()->Result<serde_json::Value,String>{let c=Client::new();let d:cargo::DeviceCode=match c.post(MS_DEVICE_URL).form(&[("client_id",MS_CLIENT_ID),("scope","XboxLive.signin offline_access")]).send().await.map_err(|e|e.to_string())?.json().await.map_err(|e|e.to_string())?;*pending().lock().map_err(|_|"Auth lock failed")?=Some((d.device_code.clone(),d.interval));Ok(serde_json::json!({"user_code":d.user_code,"verification_uri":d.verification_uri,"expires_in":d.expires_in,"interval":d.interval,"message":d.message}))}

#[tauri::command]
pub async fn microsoft_poll(app:AppHandle)->Result<Account,String>{let (device,interval)=pending().lock().map_err(|_|"Auth lock failed")?.clone().ok_or("No Microsoft login is pending")?;let c=Client::new();let t:MsToken=c.post(MS_TOKEN_URL).form(&[("client_id",MS_CLIENT_ID),("grant_type","urn:ietf:params:oauth:grant-type:device_code"),("device_code",&device)]).send().await.map_err(|e|e.to_string())?.json().await.map_err(|e|e.to_string())?;let xbl:XblResponse=c.post(XBL_USER_AUTH).json(&serde_json::json!({"Properties":{"AuthMethod":"RPS","SiteName":"user.auth.xboxlive.com","RpsTicket":format!("d={}",t.access_token)},"RelyingParty":"http://auth.xboxlive.com","TokenType":"JWT"})).send().await.map_err(|e|e.to_string())?.json().await.map_err(|e|e.to_string())?;let uhs=xbl.DisplayClaims.xui.first().ok_or("Xbox account claim missing")?.uhs.clone();let xsts:XblResponse=c.post(XSTS_AUTH).json(&serde_json::json!({"Properties":{"SandboxId":"RETAIL","UserTokens":[xbl.Token]},"RelyingParty":"rp://api.minecraftservices.com/","TokenType":"JWT"})).send().await.map_err(|e|e.to_string())?.json().await.map_err(|e|e.to_string())?;let mt:McToken=c.post(MC_LOGIN).json(&serde_json::json!({"identityToken":format!("XBL3.0 x={};{}",uhs,xsts.Token)})).send().await.map_err(|e|e.to_string())?.json().await.map_err(|e|e.to_string())?;let p:Profile=c.get(MC_PROFILE).bearer_auth(&mt.access_token).send().await.map_err(|e|e.to_string())?.json().await.map_err(|e|e.to_string())?;let a=Account{id:format!("microsoft-{}",p.id),kind:"microsoft".into(),username:p.name,uuid:p.id,access_token:mt.access_token};let mut all=read_accounts(&app);all.retain(|x|x.id!=a.id);all.push(a.clone());write_accounts(&app,&all)?;*pending().lock().map_err(|_|"Auth lock failed")?=None;let _=interval;Ok(Account{access_token:String::new(),..a})}

#[tauri::command]
pub async fn account_elyby(app:AppHandle, username:String, password:String)->Result<Account,String>{let c=Client::new();let v:serde_json::Value=c.post(ELYBY_AUTH).json(&serde_json::json!({"username":username,"password":password,"requestUser":true})).send().await.map_err(|e|e.to_string())?.json().await.map_err(|e|e.to_string())?;if v.get("error").is_some(){return Err(v.get("errorMessage").and_then(|x|x.as_str()).unwrap_or("Ely.by authentication failed").into())}let r:ElyResponse=serde_json::from_value(v).map_err(|e|e.to_string())?;let p=r.selectedProfile.ok_or("Ely.by returned no Minecraft profile")?;let a=Account{id:format!("elyby-{}",p.id),kind:"elyby".into(),username:p.name,uuid:p.id,access_token:r.accessToken};let mut all=read_accounts(&app);all.retain(|x|x.id!=a.id);all.push(a.clone());write_accounts(&app,&all)?;Ok(Account{access_token:String::new(),..a})}

#[tauri::command]
pub fn account_remove(app:AppHandle,id:String)->Result<(),String>{let mut a=read_accounts(&app);a.retain(|x|x.id!=id);write_accounts(&app,&a)}

#[tauri::command]
pub fn account_token(app:AppHandle,id:String)->Result<String,String>{read_accounts(&app).into_iter().find(|x|x.id==id).map(|x|x.access_token).ok_or("Account not found".into())}
