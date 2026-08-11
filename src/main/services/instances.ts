import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'minecraft-launcher-core';
import type { LauncherAccount } from './accounts.js';

export type Loader = 'vanilla' | 'fabric' | 'forge' | 'neoforge' | 'quilt';

export interface Instance {
  id: string;
  name: string;
  version: string;
  loader: Loader;
  loaderVersion?: string;
  icon: string;
  gameDir: string;
  javaPath?: string;
  minMemory: number;
  maxMemory: number;
  jvmArgs: string[];
  resolution?: { width: number; height: number };
  createdAt: number;
}

const dataPath = () => path.join(app.getPath('userData'), 'instances.json');
const rootPath = () => path.join(app.getPath('userData'), 'minecraft');

function read(): Instance[] {
  try { return JSON.parse(fs.readFileSync(dataPath(), 'utf8')); } catch { return []; }
}
function write(value: Instance[]) {
  fs.mkdirSync(path.dirname(dataPath()), { recursive: true });
  fs.writeFileSync(dataPath(), JSON.stringify(value, null, 2), 'utf8');
}

export class InstanceManager {
  list() { return read(); }

  create(input: Partial<Instance>) {
    if (!input.name || !input.version) throw new Error('Instance name and Minecraft version are required.');
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const instance: Instance = {
      id,
      name: input.name,
      version: input.version,
      loader: input.loader ?? 'vanilla',
      loaderVersion: input.loaderVersion,
      icon: input.icon ?? 'grass',
      gameDir: input.gameDir || path.join(rootPath(), 'instances', id),
      javaPath: input.javaPath,
      minMemory: input.minMemory ?? 1024,
      maxMemory: input.maxMemory ?? 4096,
      jvmArgs: input.jvmArgs ?? [],
      resolution: input.resolution,
      createdAt: Date.now()
    };
    fs.mkdirSync(instance.gameDir, { recursive: true });
    const instances = read(); instances.push(instance); write(instances); return instance;
  }

  remove(id: string) { write(read().filter(i => i.id !== id)); return true; }

  async launch(id: string, account?: LauncherAccount) {
    const instance = read().find(i => i.id === id);
    if (!instance) throw new Error('Instance not found.');
    if (!account) throw new Error('Add or select an account first.');

    const launcher = new Client();
    launcher.on('debug', message => console.log('[SM Launcher]', message));
    launcher.on('data', message => console.log('[Minecraft]', message));

    const opts: any = {
      authorization: {
        access_token: account.accessToken,
        client_token: account.clientToken,
        uuid: account.uuid,
        name: account.username,
        user_properties: '{}',
        meta: { type: account.kind === 'microsoft' ? 'msa' : 'mojang', demo: false }
      },
      root: rootPath(),
      version: { number: instance.version, type: 'release' },
      memory: { min: `${instance.minMemory}M`, max: `${instance.maxMemory}M` },
      overrides: { gameDirectory: instance.gameDir },
      customArgs: instance.jvmArgs
    };

    if (instance.javaPath) opts.javaPath = instance.javaPath;
    if (instance.resolution) {
      opts.features = ['has_custom_resolution'];
      opts.customLaunchArgs = ['--width', String(instance.resolution.width), '--height', String(instance.resolution.height)];
    }
    return launcher.launch(opts);
  }
}
