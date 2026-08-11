import { app, BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Authflow } from 'prismarine-auth';

export type AccountKind = 'offline' | 'microsoft' | 'elyby' | 'yggdrasil';

export interface LauncherAccount {
  id: string;
  kind: AccountKind;
  username: string;
  uuid: string;
  accessToken: string;
  clientToken: string;
  profile?: Record<string, unknown>;
  server?: string;
}

const filePath = () => path.join(app.getPath('userData'), 'accounts.json');

function read(): LauncherAccount[] {
  try { return JSON.parse(fs.readFileSync(filePath(), 'utf8')); } catch { return []; }
}

function write(accounts: LauncherAccount[]) {
  fs.mkdirSync(path.dirname(filePath()), { recursive: true });
  fs.writeFileSync(filePath(), JSON.stringify(accounts, null, 2), 'utf8');
}

export class AccountManager {
  private activeId: string | null = null;

  list() {
    return read().map(({ accessToken: _token, clientToken: _client, ...safe }) => safe);
  }

  getActive() {
    const accounts = read();
    return accounts.find(a => a.id === this.activeId) ?? accounts[0];
  }

  addOffline(username: string) {
    const clean = username.trim();
    if (!/^[A-Za-z0-9_]{3,16}$/.test(clean)) throw new Error('Offline usernames must be 3-16 letters, numbers or underscores.');
    const account: LauncherAccount = {
      id: randomUUID(), kind: 'offline', username: clean,
      uuid: randomUUID(), accessToken: '0', clientToken: randomUUID()
    };
    const accounts = read(); accounts.push(account); write(accounts); this.activeId = account.id;
    return this.publicAccount(account);
  }

  async startMicrosoftLogin() {
    const codeWindow = BrowserWindow.getAllWindows()[0];
    const cacheDir = path.join(app.getPath('userData'), 'auth-cache');
    const flow = new Authflow(`sm-launcher-${Date.now()}`, cacheDir, undefined, (code: any) => {
      codeWindow?.webContents.send('auth:microsoft-code', code);
    });
    const result = await flow.getMinecraftJavaToken({ fetchProfile: true });
    if (!result.profile) throw new Error('Microsoft account has no Minecraft Java profile.');
    const account: LauncherAccount = {
      id: randomUUID(), kind: 'microsoft', username: result.profile.name,
      uuid: result.profile.id, accessToken: result.token, clientToken: randomUUID(),
      profile: result.profile as unknown as Record<string, unknown>
    };
    const accounts = read().filter(a => a.username !== account.username);
    accounts.push(account); write(accounts); this.activeId = account.id;
    return this.publicAccount(account);
  }

  async addElyBy(input: { username: string; password: string; totp?: string }) {
    const clientToken = randomUUID();
    const password = input.totp ? `${input.password}:${input.totp}` : input.password;
    const response = await fetch('https://authserver.ely.by/auth/authenticate', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: input.username, password, clientToken, requestUser: true })
    });
    const data: any = await response.json();
    if (!response.ok) throw new Error(data.errorMessage || data.error || 'Ely.by authentication failed.');
    const profile = data.selectedProfile || data.user?.selectedProfile;
    if (!profile) throw new Error('Ely.by did not return a Minecraft profile.');
    const account: LauncherAccount = {
      id: randomUUID(), kind: 'elyby', username: profile.name, uuid: profile.id,
      accessToken: data.accessToken, clientToken, profile
    };
    const accounts = read().filter(a => a.username !== account.username); accounts.push(account);
    write(accounts); this.activeId = account.id; return this.publicAccount(account);
  }

  remove(id: string) { write(read().filter(a => a.id !== id)); if (this.activeId === id) this.activeId = null; return true; }
  setActive(id: string) { if (!read().some(a => a.id === id)) throw new Error('Account not found.'); this.activeId = id; return true; }

  private publicAccount(account: LauncherAccount) {
    const { accessToken: _token, clientToken: _client, ...safe } = account; return safe;
  }
}
