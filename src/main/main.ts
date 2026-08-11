import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { InstanceManager } from './services/instances.js';
import { AccountManager } from './services/accounts.js';
import { ModManager } from './services/mods.js';

const instances = new InstanceManager();
const accounts = new AccountManager();
const mods = new ModManager(instances);

function createWindow() {
  const win = new BrowserWindow({ width:1440, height:900, minWidth:1100, minHeight:700, backgroundColor:'#0b0d12', webPreferences:{ preload:path.join(app.getAppPath(),'dist/main/preload.js'), contextIsolation:true, nodeIntegration:false } });
  win.loadFile(path.join(app.getAppPath(),'dist/renderer/index.html'));
}

ipcMain.handle('instances:list',()=>instances.list());
ipcMain.handle('instances:create',(_e,input)=>instances.create(input));
ipcMain.handle('instances:delete',(_e,id:string)=>instances.remove(id));
ipcMain.handle('instances:launch',(_e,id:string)=>instances.launch(id,accounts.getActive()));
ipcMain.handle('accounts:list',()=>accounts.list());
ipcMain.handle('accounts:offline',(_e,username:string)=>accounts.addOffline(username));
ipcMain.handle('accounts:elyby',(_e,input)=>accounts.addElyBy(input));
ipcMain.handle('accounts:microsoft',()=>accounts.startMicrosoftLogin());
ipcMain.handle('accounts:remove',(_e,id:string)=>accounts.remove(id));
ipcMain.handle('accounts:set-active',(_e,id:string)=>accounts.setActive(id));
ipcMain.handle('mods:search',(_e,query:string,loader?:string,version?:string)=>mods.search(query,loader,version));
ipcMain.handle('mods:install',(_e,instanceId:string,versionId:string)=>mods.install(instanceId,versionId));
ipcMain.handle('mods:list',(_e,instanceId:string)=>mods.listInstalled(instanceId));
ipcMain.handle('app:open-external',(_e,url:string)=>shell.openExternal(url));

app.whenReady().then(()=>{createWindow();app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
