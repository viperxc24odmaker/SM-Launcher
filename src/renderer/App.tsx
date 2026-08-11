import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

type Page='home'|'instances'|'mods'|'accounts'|'settings';
type Instance={id:string;name:string;version:string;loader:string;icon:string;max_memory?:number;maxMemory?:number;game_dir?:string};
type Modpack={id:string;title:string;description:string;icon_url:string;downloads:number;version:string};

const packs:Modpack[]=[
 {id:'performance-essentials',title:'Performance Essentials',description:'A clean performance-focused starting point.',icon_url:'',downloads:1200000,version:'1.0'},
 {id:'vanilla-plus',title:'Vanilla+ Adventures',description:'Vanilla-friendly content and quality-of-life.',icon_url:'',downloads:860000,version:'2.4'},
 {id:'exploration',title:'Exploration',description:'Adventure, exploration and world-generation focused.',icon_url:'',downloads:640000,version:'3.1'}
];

export function App(){
 const [page,setPage]=useState<Page>('home');
 const [theme,setTheme]=useState<'dark'|'light'>('dark');
 const [query,setQuery]=useState('');
 const [ram,setRam]=useState(4096);
 const [java,setJava]=useState('Auto-detect');
 const [instances,setInstances]=useState<Instance[]>([]);
 const [toast,setToast]=useState('');
 const [creating,setCreating]=useState(false);
 const [newName,setNewName]=useState('');
 const [newVersion,setNewVersion]=useState('1.21.8');
 const [newLoader,setNewLoader]=useState('Vanilla');
 const [newIcon,setNewIcon]=useState('SC');

 useEffect(()=>{ loadInstances(); },[]);
 async function loadInstances(){ try { setInstances(await invoke<Instance[]>('list_instances')); } catch(e){ console.error(e); } }
 async function createInstance(){
   const name=newName.trim()||'My Minecraft Instance';
   const instance:Instance={id:crypto.randomUUID(),name,version:newVersion,loader:newLoader,icon:newIcon,max_memory:ram};
   const next=[...instances,instance];
   try { await invoke('save_instances',{instances:next}); setInstances(next); setCreating(false); setNewName(''); setToast(`${name} created`); } catch(e){ setToast(`Could not save instance: ${String(e)}`); }
 }
 const visiblePacks=useMemo(()=>packs.filter(p=>p.title.toLowerCase().includes(query.toLowerCase())),[query]);
 return <div className={`app ${theme}`}>
  <aside className="sidebar">
   <div className="brand"><div className="brandMark">SC</div><div><b>SM Launcher</b><small>Minecraft Java</small></div></div>
   <nav>{([['home','⌂','Library'],['instances','▦','Instances'],['mods','✦','Mods & Modpacks'],['accounts','◉','Accounts'],['settings','⚙','Settings']] as const).map(([id,ic,label])=><button className={page===id?'nav active':'nav'} onClick={()=>setPage(id)} key={id}><span>{ic}</span>{label}</button>)}</nav>
   <div className="sidebarBottom"><span className="statusDot"/>Launcher ready</div>
  </aside>
  <main className="main">
   <header className="topbar"><div><span className="eyebrow">SM LAUNCHER</span><h1>{page==='home'?'Library':page==='instances'?'Instances':page==='mods'?'Mods & Modpacks':page==='accounts'?'Accounts':'Settings'}</h1></div><div className="topActions"><button className="iconBtn" onClick={()=>setPage('settings')}>⚙</button><button className="profilePill"><span className="avatar">SC</span>Player</button></div></header>
   {page==='home'&&<>
    <section className="hero"><div><span className="eyebrow">MINECRAFT JAVA EDITION</span><h2>Your worlds. Your instances. Your way.</h2><p>A polished launcher for isolated instances, modpacks, accounts and Minecraft customization.</p><div className="heroActions"><button className="primary" onClick={()=>setPage('instances')}>Browse instances</button><button className="secondary" onClick={()=>setPage('mods')}>Explore modpacks</button></div></div><div className="heroLogo">SC</div></section>
    <section className="section"><div className="sectionTitle"><div><h3>Quick start</h3><p className="muted">Jump straight into the things you use most.</p></div></div><div className="cards3"><Info icon="▦" title="Instances" text="Create isolated vanilla or modded profiles." action={()=>setPage('instances')}/><Info icon="✦" title="Modpacks" text="Discover packs with artwork and metadata." action={()=>setPage('mods')}/><Info icon="⚙" title="Settings" text="Tune Java, RAM and the launcher experience." action={()=>setPage('settings')}/></div></section>
   </>}
   {page==='instances'&&<section className="section"><div className="sectionTitle"><div><h3>Your instances</h3><p className="muted">Every instance keeps its own game files and settings.</p></div><button className="primary" onClick={()=>setCreating(true)}>＋ New instance</button></div><div className="instanceGrid">
    {instances.map(i=><article className="instanceCard" key={i.id}><div className="instanceIcon">{i.icon}</div><div className="instanceMeta"><b>{i.name}</b><span>{i.loader} <i>·</i> Minecraft {i.version}</span></div><div className="cardBottom"><span>{i.max_memory||i.maxMemory||ram} MB RAM</span><span>Ready</span></div><button className="play" title="Launch instance" onClick={()=>setToast('Minecraft launch service is ready for the next game-runtime pass.')}>▶</button></article>)}
    {!instances.length&&<div className="empty"><div>▦</div><b>No instances yet</b><p>Create your first Minecraft profile to get started.</p><button className="secondary" onClick={()=>setCreating(true)}>Create instance</button></div>}
   </div></section>}
   {page==='mods'&&<section className="section"><div className="sectionTitle"><div><h3>Modpacks</h3><p className="muted">Discover packs, view artwork and install them into instances.</p></div><input className="search" placeholder="Search modpacks…" value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="catalog">{visiblePacks.map(p=><article className="catalogCard" key={p.id}><div className="modIcon">✦</div><div className="catalogBody"><b>{p.title}</b><p>{p.description}</p><span>{p.version} · {p.downloads.toLocaleString()} downloads</span></div><button className="secondary" onClick={()=>setToast('Modrinth installer backend is being wired to this catalog.')}>Install</button></article>)}</div></section>}
   {page==='accounts'&&<section className="section"><h3>Accounts</h3><p className="muted">Choose how SM Launcher signs you into Minecraft.</p><div className="accountActions"><button className="primary" onClick={()=>setToast('Microsoft authentication backend is next.')}>Microsoft</button><button className="secondary" onClick={()=>setToast('Ely.by authentication backend is next.')}>Ely.by</button><button className="secondary" onClick={()=>setToast('Offline profile creation is next.')}>Offline</button></div><div className="accountList"><div className="accountRow selected"><div className="avatar large">SC</div><div><b>Offline profile</b><span>Offline · ready to use</span></div><span className="accountCheck">✓</span></div></div></section>}
   {page==='settings'&&<section className="section"><h3>Settings</h3><p className="muted">Make SM Launcher fit the way you play.</p><div className="settingsPanel"><div><b>Appearance</b><p>Launcher theme</p></div><div className="segmented"><button className={theme==='dark'?'selected':''} onClick={()=>setTheme('dark')}>Dark</button><button className={theme==='light'?'selected':''} onClick={()=>setTheme('light')}>Light</button></div></div><div className="settingsPanel"><div><b>Maximum RAM</b><p>{ram} MB allocated to Minecraft</p></div><input type="range" min="2048" max="16384" step="512" value={ram} onChange={e=>setRam(+e.target.value)}/></div><div className="settingsPanel"><div><b>Java runtime</b><p>Runtime used by Minecraft instances</p></div><select value={java} onChange={e=>setJava(e.target.value)}><option>Auto-detect</option><option>Java 21</option><option>Java 17</option></select></div><div className="settingsPanel"><div><b>Desktop engine</b><p>Native Tauri 2 application runtime</p></div><span className="badge">Tauri 2</span></div></section>}
  </main>
  {creating&&<div className="modalBackdrop"><div className="modal"><div className="modalHead"><div><span className="eyebrow">INSTANCE SETUP</span><h3>Create instance</h3></div><button className="iconBtn" onClick={()=>setCreating(false)}>×</button></div><label>Name<input autoFocus value={newName} onChange={e=>setNewName(e.target.value)} placeholder="My Minecraft Instance"/></label><label>Minecraft version<select value={newVersion} onChange={e=>setNewVersion(e.target.value)}><option>1.21.8</option><option>1.21.5</option><option>1.21.1</option><option>1.20.1</option></select></label><label>Loader<select value={newLoader} onChange={e=>setNewLoader(e.target.value)}><option>Vanilla</option><option>Fabric</option><option>Forge</option><option>NeoForge</option><option>Quilt</option></select></label><label>Instance icon<div className="iconPicker">{['SC','◆','✦','⬢','◈'].map(x=><button className={newIcon===x?'picked':''} onClick={()=>setNewIcon(x)} key={x}>{x}</button>)}</div></label><div className="modalFoot"><button className="secondary" onClick={()=>setCreating(false)}>Cancel</button><button className="primary" onClick={createInstance}>Create instance</button></div></div></div>}
  {toast&&<div className="toast"><button onClick={()=>setToast('')}>×</button><b>SM Launcher</b><span>{toast}</span></div>}
 </div>
}
function Info({icon,title,text,action}:{icon:string;title:string;text:string;action:()=>void}){return <button className="infoCard" onClick={action}><span className="infoIcon">{icon}</span><span><b>{title}</b><p>{text}</p></span><span>→</span></button>}
