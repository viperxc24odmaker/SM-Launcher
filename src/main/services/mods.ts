import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import type { InstanceManager } from './instances.js';

export class ModManager {
  constructor(private readonly instances: InstanceManager) {}

  async search(query: string, loader = '', gameVersion = '') {
    const params = new URLSearchParams({ query, limit: '24' });
    const facets: string[][] = [['project_type:mod']];
    if (loader && loader !== 'vanilla') facets.push([`categories:${loader}`]);
    if (gameVersion) facets.push([`versions:${gameVersion}`]);
    params.set('facets', JSON.stringify(facets));
    const response = await fetch(`https://api.modrinth.com/v2/search?${params}`);
    if (!response.ok) throw new Error(`Modrinth search failed (${response.status}).`);
    return response.json();
  }

  async install(instanceId: string, versionId: string) {
    const instance = this.instances.list().find(i => i.id === instanceId);
    if (!instance) throw new Error('Instance not found.');
    const response = await fetch(`https://api.modrinth.com/v2/version/${encodeURIComponent(versionId)}`);
    if (!response.ok) throw new Error(`Could not resolve Modrinth version (${response.status}).`);
    const version: any = await response.json();
    const file = version.files?.find((f: any) => f.primary) ?? version.files?.[0];
    if (!file?.url) throw new Error('This mod version has no downloadable file.');
    const download = await fetch(file.url);
    if (!download.ok) throw new Error(`Mod download failed (${download.status}).`);
    const bytes = Buffer.from(await download.arrayBuffer());
    const modsDir = path.join(instance.gameDir, 'mods');
    fs.mkdirSync(modsDir, { recursive: true });
    const safeName = path.basename(file.filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const destination = path.join(modsDir, safeName);
    fs.writeFileSync(destination, bytes);
    return { filename: safeName, path: destination, size: bytes.length };
  }

  async listInstalled(instanceId: string) {
    const instance = this.instances.list().find(i => i.id === instanceId);
    if (!instance) throw new Error('Instance not found.');
    const modsDir = path.join(instance.gameDir, 'mods');
    if (!fs.existsSync(modsDir)) return [];
    return fs.readdirSync(modsDir).filter(f => /\.(jar|zip)$/i.test(f)).map(name => ({ name, path: path.join(modsDir, name) }));
  }
}
