# SM Launcher

A professional Minecraft: Java Edition launcher focused on instance management, modding, accounts and customization.

## Current foundation

- Electron + React desktop UI with dark/light themes
- Per-instance profiles with icons, versions, loaders, RAM, JVM arguments and isolated game directories
- Vanilla, Fabric, Forge, NeoForge and Quilt profile model
- Minecraft launching through Minecraft Launcher Core
- Microsoft account authentication through `prismarine-auth` with cached OAuth credentials
- Offline accounts
- Ely.by authentication using the documented Ely.by authentication endpoint
- OS-backed encryption for stored account tokens when Electron `safeStorage` is available
- Cross-platform packaging targets for Windows, Linux and macOS
- GitHub Actions build/typecheck pipeline

## Planned feature set

The architecture is intentionally built around the same broad capabilities users expect from modern launchers, without copying proprietary SKlauncher code, branding or private APIs:

1. Modrinth mod/modpack/shader browser and one-click installation
2. CurseForge integration when a user-provided API key is configured
3. Automatic Fabric/Forge/NeoForge/Quilt installer management
4. Per-instance file explorer, screenshots, logs and crash-report tools
5. Java runtime discovery and automatic per-version JRE provisioning
6. Instance import/export from Prism, MultiMC, ATLauncher and compatible layouts
7. Server manager and quick-connect profiles
8. Skin/cape/profile management for supported account providers
9. Backup/restore and instance duplication
10. Custom themes, accent colors, layouts and launcher branding
11. Malware/privacy checks for downloaded mods and packs
12. Download queue, parallel downloads, retry handling and progress UI

## Authentication notes

Microsoft authentication uses the maintained PrismarineJS authentication stack rather than borrowing SKlauncher's private credentials or client secrets. Ely.by integration follows its public authentication documentation. SKlauncher does not publish a public launcher-auth API in its current documentation, so SM Launcher does **not** pretend to support a private SKlauncher endpoint; a future official/public integration can be added without changing the account architecture.

## Development

```bash
npm install
npm run typecheck
npm run build
npm start
```

Build distributables with:

```bash
npm run package
```

Minecraft game files are downloaded by the launcher core from Minecraft's public distribution infrastructure; SM Launcher does not bundle pirated game files.
