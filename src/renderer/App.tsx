import { useEffect, useMemo, useState } from 'react';

type Page = 'home' | 'instances' | 'mods' | 'accounts' | 'settings';
type Instance = { id:string; name:string; version:string; loader:string; icon:string; gameDir:string; maxMemory:number };
type Account = { id:string; kind:string; username:string; uuid:string };

declare global { interface Window { smLauncher: any } }

const icons = ['grass','diamond','nether','ender','redstone','command','sword','pickaxe'];

export function App() {
  const [page, setPage] = useState<Page>('home');
  const [instances, setInstances] = useState<Instance[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [active, setActive] = useState('');
  const [theme, setTheme] = useState<'dark'|'light'>('dark');
  const [modal, setModal] = useState(false);
  const [authCode, setAuthCode] = useState<any>(null);
  const [form, setForm] = useState({ name:'Survival', version:'1.21.8', loader:'vanilla', icon:'grass', maxMemory:4096 });

  const activeAccount = useMemo(() => accounts.find(a => a.id === active) ?? accounts[0], [accounts, active]);

  const refresh = async () => { setInstances(await window.smLauncher.instances.list()); setAccounts(await window.smLauncher.accounts.list()); };
  useEffect(() => { refresh(); const fn = (_e:any, code:any) => setAuthCode(code); window.smLauncher?.onMicrosoftCode?.(fn); return () => {}; }, []);

  const launch = async (id:string) => {
    try { await window.smLauncher.instances.launch(id); }
    catch (e:any) { alert(e?.message ?? String(e)); }
  };

  const create = async () => {
    await window.smLauncher.instances.create(form); setModal(false); await refresh();
  };

  const offline = async () => {
    const username = prompt('Offline username (3-16 characters):'); if (!username) return;
    try { await window.smLauncher.accounts.offline(username); await refresh(); }
    catch (e:any) { alert(e?.message ?? String(e)); }
  };

  const microsoft = async () => {
    try { await window.smLauncher.accounts.microsoft(); await refresh(); }
    catch (e:any) { alert(e?.message ?? String(e)); }
  };

  const elyby = async () => {
    const username = prompt('Ely.by email/username:'); if (!username) return;
    const password = prompt('Ely.by password (used only for this login):'); if (!password) return;
    try { await window.smLauncher.accounts.elyby({ username, password }); await refresh(); }
    catch (e:any) { alert(e?.message ?? String(e)); }
  };

  return <div className={`app ${theme}`}>
    <aside className="sidebar">
      <div className="brand"><div className="brandMark">SM</div><div><b>SM Launcher</b><small>Java Edition</small></div></div>
      <nav>
        {([['home','⌂','Home'],['instances','▦','Instances'],['mods','✦','Mods & Packs'],['accounts','◉','Accounts'],['settings','⚙','Settings']] as const).map(([id,icon,label]) =>
          <button className={page===id?'nav active':'nav'} onClick={()=>setPage(id)} key={id}><span>{icon}</span>{label}</button>)}
      </nav>
      <div className="sidebarBottom"><div className="statusDot"/> Online services ready</div>
    </aside>

    <main className="main">
      <header className="topbar"><div><span className="eyebrow">MINECRAFT JAVA</span><h1>{page === 'home' ? 'Welcome back' : page === 'instances' ? 'Instances' : page === 'mods' ? 'Mods & Modpacks' : page === 'accounts' ? 'Accounts' : 'Settings'}</h1></div>
        <div className="topActions"><button className="iconBtn" onClick={refresh}>↻</button><div className="profilePill"><span className="avatar">{activeAccount?.username?.[0]?.toUpperCase() ?? '?'}</span><span>{activeAccount?.username ?? 'No account'}</span></div></div>
      </header>

      {page==='home' && <>
        <section className="hero"><div><span className="eyebrow">READY TO PLAY</span><h2>{activeAccount ? `Let's build something, ${activeAccount.username}.` : 'Your Minecraft, your way.'}</h2><p>Fast instance management, clean profiles, mods, loaders and deep customization in one launcher.</p><button className="primary" onClick={()=>setPage('instances')}>Open instances <span>→</span></button></div><div className="heroCube">⛏</div></section>
        <section className="section"><div className="sectionTitle"><h3>Quick launch</h3><button onClick={()=>setModal(true)} className="textBtn">+ New instance</button></div><div className="instanceGrid">{instances.slice(0,4).map(i=><InstanceCard key={i.id} instance={i} onLaunch={()=>launch(i.id)}/>)}{instances.length===0 && <Empty title="No instances yet" text="Create your first Vanilla, Fabric, Forge, Quilt or NeoForge profile." action={()=>setModal(true)}/>}</div></section>
        <section className="cards3"><InfoCard icon="⚡" title="Fast startup" text="Parallel downloads and per-instance settings."/><InfoCard icon="🧩" title="Mod-ready" text="Keep mods, shaders and resource packs isolated."/><InfoCard icon="🎨" title="Make it yours" text="Themes, icons, layouts and memory profiles."/></section>
      </>}

      {page==='instances' && <section className="section"><div className="sectionTitle"><div><h3>Your instances</h3><p className="muted">Separate worlds, mods, settings and Java options per profile.</p></div><button className="primary" onClick={()=>setModal(true)}>+ New instance</button></div><div className="instanceGrid">{instances.map(i=><InstanceCard key={i.id} instance={i} onLaunch={()=>launch(i.id)}/>) }{instances.length===0 && <Empty title="No instances" text="Create an instance to get started." action={()=>setModal(true)}/>}</div></section>}

      {page==='mods' && <section className="section"><div className="sectionTitle"><div><h3>Mods & modpacks</h3><p className="muted">A dedicated place for your modded setups.</p></div><button className="secondary">Browse Modrinth</button></div><div className="modBanner"><div className="modIcon">✦</div><div><b>Mod manager foundation is ready</b><p>Instance-aware mod folders, loader compatibility and one-click downloads are next in the pipeline.</p></div></div><div className="catalog"><div className="catalogCard"><b>Modrinth</b><span>Public API integration</span></div><div className="catalogCard"><b>CurseForge</b><span>API-key aware integration</span></div><div className="catalogCard"><b>Shaders</b><span>Instance-scoped shader packs</span></div></div></section>}

      {page==='accounts' && <section className="section"><div className="sectionTitle"><div><h3>Account manager</h3><p className="muted">Multiple profiles. Switch without restarting the launcher.</p></div></div><div className="accountActions"><button className="primary" onClick={microsoft}>Microsoft</button><button className="secondary" onClick={elyby}>Ely.by</button><button className="secondary" onClick={offline}>Offline</button></div><div className="accountList">{accounts.map(a=><div className={`accountRow ${activeAccount?.id===a.id?'selected':''}`} key={a.id} onClick={()=>{setActive(a.id); window.smLauncher.accounts.setActive(a.id)}}><div className="avatar large">{a.username[0].toUpperCase()}</div><div><b>{a.username}</b><span>{a.kind} · {a.uuid.slice(0,8)}…</span></div><span className="accountCheck">{activeAccount?.id===a.id?'✓':''}</span></div>)}</div></section>}

      {page==='settings' && <section className="section"><div className="settingsPanel"><div><b>Appearance</b><p>Choose how SM Launcher looks.</p></div><div className="segmented"><button className={theme==='dark'?'selected':''} onClick={()=>setTheme('dark')}>Dark</button><button className={theme==='light'?'selected':''} onClick={()=>setTheme('light')}>Light</button></div></div><div className="settingsPanel"><div><b>Instance storage</b><p>Each profile gets its own game directory by default.</p></div><span className="badge">Isolated</span></div><div className="settingsPanel"><div><b>Launcher engine</b><p>Electron UI + Minecraft Launcher Core. Game files are fetched from official Minecraft resources.</p></div><span className="badge">SM Core</span></div></section>}
    </main>

    {modal && <div className="modalBackdrop"><div className="modal"><div className="modalHead"><div><span className="eyebrow">NEW PROFILE</span><h3>Create instance</h3></div><button className="iconBtn" onClick={()=>setModal(false)}>×</button></div><label>Name<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Minecraft version<input value={form.version} onChange={e=>setForm({...form,version:e.target.value})}/></label><label>Loader<select value={form.loader} onChange={e=>setForm({...form,loader:e.target.value})}><option value="vanilla">Vanilla</option><option value="fabric">Fabric</option><option value="forge">Forge</option><option value="neoforge">NeoForge</option><option value="quilt">Quilt</option></select></label><label>Icon<div className="iconPicker">{icons.map(x=><button className={form.icon===x?'picked':''} onClick={()=>setForm({...form,icon:x})} key={x}>{x[0].toUpperCase()}</button>)}</div></label><label>Maximum RAM (MB)<input type="number" value={form.maxMemory} onChange={e=>setForm({...form,maxMemory:Number(e.target.value)})}/></label><div className="modalFoot"><button className="secondary" onClick={()=>setModal(false)}>Cancel</button><button className="primary" onClick={create}>Create instance</button></div></div></div>}
    {authCode && <div className="toast"><b>Microsoft sign-in</b><span>{authCode.message ?? 'Open the displayed link and enter the code.'}</span><button onClick={()=>setAuthCode(null)}>×</button></div>}
  </div>
}

function InstanceCard({instance,onLaunch}:{instance:Instance;onLaunch:()=>void}) { return <article className="instanceCard"><div className="instanceIcon">{instance.icon[0].toUpperCase()}</div><div className="instanceMeta"><b>{instance.name}</b><span>{instance.loader} · {instance.version}</span></div><button className="play" onClick={onLaunch}>▶</button><div className="cardBottom"><span>{instance.maxMemory} MB RAM</span><span>⋮</span></div></article> }
function InfoCard({icon,title,text}:{icon:string;title:string;text:string}) { return <div className="infoCard"><span className="infoIcon">{icon}</span><div><b>{title}</b><p>{text}</p></div></div> }
function Empty({title,text,action}:{title:string;text:string;action:()=>void}) { return <div className="empty"><div>▦</div><b>{title}</b><p>{text}</p><button className="secondary" onClick={action}>Create one</button></div> }
