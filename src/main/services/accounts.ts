import { app, BrowserWindow, safeStorage } from 'electron';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Authflow } from 'prismarine-auth';

export type AccountKind = 'offline' | 'microsoft' | 'elyby' | 'yggdrasil';
export interface LauncherAccount { id:string; kind:AccountKind; username:string; uuid:string; accessToken:string; clientToken:string; profile?:Record<string,unknown>; server?:string }
type Store={accounts:LauncherAccount[];activeId?:string};
const filePath=()=>path.join(app.getPath('userData'),'accounts.bin');
function read():Store{try{const raw=fs.readFileSync(filePath());const text=safeStorage.isEncryptionAvailable()?safeStorage.decryptString(raw):raw.toString('utf8');return JSON.parse(text);}catch{return{accounts:[]};}}
function write(store:Store){fs.mkdirSync(path.dirname(filePath()),{recursive:true});const text=JSON.stringify(store,null,2);const data=safeStorage.isEncryptionAvailable()?safeStorage.encryptString(text):Buffer.from(text,'utf8');fs.writeFileSync(filePath(),data);}

export class AccountManager{
 list(){return read().accounts.map(({accessToken:_a,clientToken:_c,...safe})=>safe);}
 getActive(){const s=read();return s.accounts.find(a=>a.id===s.activeId)??s.accounts[0];}
 addOffline(username:string){const clean=username.trim();if(!/^[A-Za-z0-9_]{3,16}$/.test(clean))throw new Error('Offline usernames must be 3-16 letters, numbers or underscores.');const account:LauncherAccount={id:randomUUID(),kind:'offline',username:clean,uuid:randomUUID(),accessToken:'0',clientToken:randomUUID()};const s=read();s.accounts=s.accounts.filter(a=>a.username!==clean);s.accounts.push(account);s.activeId=account.id;write(s);return this.publicAccount(account);}
 async startMicrosoftLogin(){const win=BrowserWindow.getAllWindows()[0];const cacheDir=path.join(app.getPath('userData'),'auth-cache');const flow=new Authflow(`sm-launcher-${Date.now()}`,cacheDir,undefined,(code:any)=>win?.webContents.send('auth:microsoft-code',code));const result=await flow.getMinecraftJavaToken({fetchProfile:true});if(!result.profile)throw new Error('Microsoft account has no Minecraft Java profile.');const account:LauncherAccount={id:randomUUID(),kind:'microsoft',username:result.profile.name,uuid:result.profile.id,accessToken:result.token,clientToken:randomUUID(),profile:result.profile as unknown as Record<string,unknown>};const s=read();s.accounts=s.accounts.filter(a=>a.username!==account.username);s.accounts.push(account);s.activeId=account.id;write(s);return this.publicAccount(account);}
 async addElyBy(input:{username:string;password:string;totp?:string}){const clientToken=randomUUID();const password=input.totp?`${input.password}:${input.totp}`:input.password;const response=await fetch('https://authserver.ely.by/auth/authenticate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:input.username,password,clientToken,requestUser:true})});const data:any=await response.json();if(!response.ok)throw new Error(data.errorMessage||data.error||'Ely.by authentication failed.');const profile=data.selectedProfile||data.user?.selectedProfile;if(!profile)throw new Error('Ely.by did not return a Minecraft profile.');const account:LauncherAccount={id:randomUUID(),kind:'elyby',username:profile.name,uuid:profile.id,accessToken:data.accessToken,clientToken,profile};const s=read();s.accounts=s.accounts.filter(a=>a.username!==account.username);s.accounts.push(account);s.activeId=account.id;write(s);return this.publicAccount(account);}
 remove(id:string){const s=read();s.accounts=s.accounts.filter(a=>a.id!==id);if(s.activeId===id)s.activeId=s.accounts[0]?.id;write(s);return true;}
 setActive(id:string){const s=read();if(!s.accounts.some(a=>a.id===id))throw new Error('Account not found.');s.activeId=id;write(s);return true;}
 private publicAccount(a:LauncherAccount){const{accessToken:_a,clientToken:_c,...safe}=a;return safe;}
}
