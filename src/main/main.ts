import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { InstanceManager } from './services/instances.js';
import { AccountManager } from './services/accounts.js';

const instances = new InstanceManager();
const accounts = new AccountManager();

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0b0d12',
    webPreferences: {
      preload: path.join(app.getAppPath(), 'dist/main/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(app.getAppPath(), 'dist/renderer/index.html'));
}

ipcMain.handle('instances:list', () => instances.list());
ipcMain.handle('instances:create', (_event, input) => instances.create(input));
ipcMain.handle('instances:delete', (_event, id: string) => instances.remove(id));
ipcMain.handle('instances:launch', (_event, id: string) => instances.launch(id, accounts.getActive()));

ipcMain.handle('accounts:list', () => accounts.list());
ipcMain.handle('accounts:offline', (_event, username: string) => accounts.addOffline(username));
ipcMain.handle('accounts:elyby', (_event, input) => accounts.addElyBy(input));
ipcMain.handle('accounts:microsoft', () => accounts.startMicrosoftLogin());
ipcMain.handle('accounts:remove', (_event, id: string) => accounts.remove(id));
ipcMain.handle('accounts:set-active', (_event, id: string) => accounts.setActive(id));
ipcMain.handle('app:open-external', (_event, url: string) => shell.openExternal(url));

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
