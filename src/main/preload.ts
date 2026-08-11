import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('smLauncher',{
 instances:{list:()=>ipcRenderer.invoke('instances:list'),create:(input:unknown)=>ipcRenderer.invoke('instances:create',input),delete:(id:string)=>ipcRenderer.invoke('instances:delete',id),launch:(id:string)=>ipcRenderer.invoke('instances:launch',id)},
 accounts:{list:()=>ipcRenderer.invoke('accounts:list'),offline:(username:string)=>ipcRenderer.invoke('accounts:offline',username),elyby:(input:unknown)=>ipcRenderer.invoke('accounts:elyby',input),microsoft:()=>ipcRenderer.invoke('accounts:microsoft'),remove:(id:string)=>ipcRenderer.invoke('accounts:remove',id),setActive:(id:string)=>ipcRenderer.invoke('accounts:set-active',id)},
 mods:{search:(query:string,loader?:string,version?:string)=>ipcRenderer.invoke('mods:search',query,loader,version),install:(instanceId:string,versionId:string)=>ipcRenderer.invoke('mods:install',instanceId,versionId),list:(instanceId:string)=>ipcRenderer.invoke('mods:list',instanceId)},
 onMicrosoftCode:(callback:(event:unknown,code:unknown)=>void)=>ipcRenderer.on('auth:microsoft-code',callback),
 openExternal:(url:string)=>ipcRenderer.invoke('app:open-external',url)
});
