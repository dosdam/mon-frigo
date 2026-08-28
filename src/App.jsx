import { useEffect, useMemo, useState } from 'react';
import Scanner from './components/Scanner.jsx';

const initialAppliances = [
  { id: 'a1', name: 'Congélateur cuisine', type: 'Congélateur', shelves: ['Tiroir 1','Tiroir 2','Tiroir 3'] },
  { id: 'a2', name: 'Réfrigérateur', type: 'Réfrigérateur', shelves: ['Étage haut','Étage milieu','Bac à légumes','Porte'] }
];
const initialProducts = [
  { id:'p1', name:'Petits pois', barcode:'3564700000012', quantity:2, unit:'sachets', applianceId:'a1', shelf:'Tiroir 2', expiry:'2026-11-15' },
  { id:'p2', name:'Saumon', barcode:'3289470000023', quantity:4, unit:'portions', applianceId:'a1', shelf:'Tiroir 1', expiry:'2026-09-04' }
];
const units = ['unités','sachets','boîtes','portions','kg','litres'];
const load = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } };
const daysLeft = date => Math.ceil((new Date(`${date}T00:00:00`) - new Date().setHours(0,0,0,0)) / 86400000);

export default function App() {
  const [appliances, setAppliances] = useState(() => load('mc-appliances', initialAppliances));
  const [products, setProducts] = useState(() => load('mc-products', initialProducts));
  const [tab, setTab] = useState('home');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  useEffect(() => localStorage.setItem('mc-appliances', JSON.stringify(appliances)), [appliances]);
  useEffect(() => localStorage.setItem('mc-products', JSON.stringify(products)), [products]);

  const visible = useMemo(() => products.filter(p => (filter === 'all' || p.applianceId === filter) && `${p.name} ${p.barcode}`.toLowerCase().includes(search.toLowerCase())).sort((a,b) => a.expiry.localeCompare(b.expiry)), [products,filter,search]);
  const alerts = products.filter(p => daysLeft(p.expiry) <= 7).sort((a,b) => a.expiry.localeCompare(b.expiry));

  function openCode(code) { const product = products.find(p => p.barcode === code) || null; setModal({type:'product', product, barcode:code}); }
  function save(product) { setProducts(list => product.id ? list.map(p => p.id === product.id ? product : p) : [{...product,id:`p-${Date.now()}`},...list]); setModal(null); }
  function quantity(id, delta) { setProducts(list => list.map(p => p.id === id ? {...p,quantity:Math.max(0,Number(p.quantity)+delta)} : p).filter(p=>p.quantity>0)); }

  return <div className="mx-auto min-h-screen max-w-md bg-slate-50 pb-24 shadow-xl">
    <header className="safe-top rounded-b-[2rem] bg-gradient-to-br from-cyan-600 to-blue-700 px-5 pb-6 text-white">
      <p className="text-sm text-cyan-100">Inventaire intelligent</p><h1 className="text-2xl font-bold">❄ Mon Congélateur</h1>
      <div className="mt-5 grid grid-cols-3 gap-2 text-center"><Stat value={products.length} label="produits"/><Stat value={products.reduce((n,p)=>n+Number(p.quantity),0)} label="quantité"/><Stat value={alerts.length} label="à surveiller"/></div>
    </header>
    <main className="space-y-4 px-4 pt-5">
      {tab === 'home' && <>
        <div className="grid grid-cols-2 gap-3"><Action primary title="Scanner" text="Avec la caméra" onClick={()=>setModal({type:'scan'})}/><Action title="Ajouter" text="Saisie manuelle" onClick={()=>setModal({type:'product',product:null,barcode:''})}/></div>
        <h2 className="pt-2 text-lg font-bold">Mes appareils</h2>
        {appliances.map(a=><button key={a.id} onClick={()=>{setFilter(a.id);setTab('stock')}} className="flex w-full items-center rounded-2xl bg-white p-4 text-left shadow-sm"><span className="mr-3 grid h-11 w-11 place-items-center rounded-xl bg-cyan-100 text-xl">{a.type==='Congélateur'?'❄':'🧊'}</span><span className="flex-1"><b>{a.name}</b><small className="block text-slate-500">{products.filter(p=>p.applianceId===a.id).length} produit(s) · {a.shelves.length} emplacement(s)</small></span><span>›</span></button>)}
        <h2 className="pt-2 text-lg font-bold">À consommer rapidement</h2>{alerts.length ? alerts.map(p=><ExpiryRow key={p.id} p={p}/>) : <Empty text="Aucune date proche"/>}
      </>}
      {tab === 'stock' && <>
        <h2 className="text-xl font-bold">Mon stock</h2><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Produit ou code-barres" className="w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-cyan-500"/>
        <div className="flex gap-2 overflow-x-auto"><Chip active={filter==='all'} onClick={()=>setFilter('all')}>Tout</Chip>{appliances.map(a=><Chip key={a.id} active={filter===a.id} onClick={()=>setFilter(a.id)}>{a.name}</Chip>)}</div>
        {visible.length ? visible.map(p=><ProductRow key={p.id} p={p} appliance={appliances.find(a=>a.id===p.applianceId)} onEdit={()=>setModal({type:'product',product:p,barcode:p.barcode})} onQty={quantity}/>) : <Empty text="Aucun produit trouvé"/>}
      </>}
      {tab === 'dates' && <><h2 className="text-xl font-bold">Dates de péremption</h2>{['Périmés','Dans les 7 jours','Plus tard'].map(group=>{const list=products.filter(p=>group==='Périmés'?daysLeft(p.expiry)<0:group==='Dans les 7 jours'?daysLeft(p.expiry)>=0&&daysLeft(p.expiry)<=7:daysLeft(p.expiry)>7);return <section key={group}><h3 className="mb-2 mt-4 font-semibold">{group} <span className="rounded-full bg-slate-200 px-2 py-1 text-xs">{list.length}</span></h3>{list.map(p=><ExpiryRow key={p.id} p={p}/>)}</section>})}</>}
      {tab === 'settings' && <Settings appliances={appliances} setAppliances={setAppliances} products={products}/>} 
    </main>
    <button onClick={()=>setModal({type:'scan'})} className="fixed bottom-16 left-1/2 z-20 h-16 w-16 -translate-x-1/2 rounded-full border-4 border-slate-50 bg-cyan-600 text-2xl text-white shadow-xl">▣</button>
    <nav className="safe-bottom fixed bottom-0 left-1/2 flex h-20 w-full max-w-md -translate-x-1/2 items-center justify-around border-t bg-white"><Nav active={tab==='home'} onClick={()=>setTab('home')} icon="⌂" text="Accueil"/><Nav active={tab==='stock'} onClick={()=>setTab('stock')} icon="□" text="Stock"/><span className="w-12"/><Nav active={tab==='dates'} onClick={()=>setTab('dates')} icon="◷" text="Dates"/><Nav active={tab==='settings'} onClick={()=>setTab('settings')} icon="⚙" text="Réglages"/></nav>
    {modal && <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/60" onMouseDown={e=>e.target===e.currentTarget&&setModal(null)}><div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[2rem] bg-slate-50 p-5 safe-bottom">{modal.type==='scan'?<Scanner onScan={openCode} onClose={()=>setModal(null)}/>:<ProductForm appliances={appliances} product={modal.product} barcode={modal.barcode} onClose={()=>setModal(null)} onSave={save} onDelete={modal.product?()=>{setProducts(x=>x.filter(p=>p.id!==modal.product.id));setModal(null)}:null}/>}</div></div>}
  </div>;
}

function ProductForm({appliances,product,barcode,onSave,onClose,onDelete}) { const first=appliances[0]; const [form,setForm]=useState(product||{name:'',barcode,quantity:1,unit:'unités',applianceId:first?.id||'',shelf:first?.shelves[0]||'',expiry:new Date(Date.now()+30*86400000).toISOString().slice(0,10)}); const appliance=appliances.find(a=>a.id===form.applianceId)||first; const set=(k,v)=>setForm(f=>({...f,[k]:v})); return <form onSubmit={e=>{e.preventDefault();onSave(form)}} className="space-y-3"><div className="flex justify-between"><h2 className="text-xl font-bold">{product?'Modifier':'Ajouter'} un produit</h2><button type="button" onClick={onClose} className="rounded-full bg-slate-200 px-3 py-1">×</button></div><Field label="Nom"><input required value={form.name} onChange={e=>set('name',e.target.value)} className="input"/></Field><Field label="Code-barres"><input value={form.barcode} onChange={e=>set('barcode',e.target.value)} className="input"/></Field><div className="grid grid-cols-2 gap-3"><Field label="Quantité"><input required type="number" min="1" value={form.quantity} onChange={e=>set('quantity',Number(e.target.value))} className="input"/></Field><Field label="Unité"><select value={form.unit} onChange={e=>set('unit',e.target.value)} className="input bg-white">{units.map(u=><option key={u}>{u}</option>)}</select></Field></div><Field label="Appareil"><select value={form.applianceId} onChange={e=>{const a=appliances.find(x=>x.id===e.target.value);setForm(f=>({...f,applianceId:a.id,shelf:a.shelves[0]}))}} className="input bg-white">{appliances.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></Field><Field label="Étage / tiroir"><select value={form.shelf} onChange={e=>set('shelf',e.target.value)} className="input bg-white">{appliance?.shelves.map(s=><option key={s}>{s}</option>)}</select></Field><Field label="Date de péremption"><input required type="date" value={form.expiry} onChange={e=>set('expiry',e.target.value)} className="input"/></Field><button className="w-full rounded-xl bg-cyan-600 p-3 font-semibold text-white">Enregistrer</button>{onDelete&&<button type="button" onClick={onDelete} className="w-full rounded-xl border border-red-200 p-3 text-red-600">Supprimer</button>}</form> }
function Settings({appliances,setAppliances,products}) { const [name,setName]=useState(''); const [type,setType]=useState('Congélateur'); function add(e){e.preventDefault();if(!name.trim())return;setAppliances(x=>[...x,{id:`a-${Date.now()}`,name:name.trim(),type,shelves:type==='Congélateur'?['Tiroir 1','Tiroir 2','Tiroir 3']:['Étage haut','Étage milieu','Bac à légumes','Porte']}]);setName('')} return <><h2 className="text-xl font-bold">Mes appareils</h2>{appliances.map(a=><div key={a.id} className="flex items-center rounded-2xl bg-white p-4 shadow-sm"><span className="flex-1"><b>{a.name}</b><small className="block text-slate-500">{a.shelves.join(' · ')}</small></span><button disabled={products.some(p=>p.applianceId===a.id)} onClick={()=>setAppliances(x=>x.filter(v=>v.id!==a.id))} className="text-red-500 disabled:opacity-20">Supprimer</button></div>)}<form onSubmit={add} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm"><b>Ajouter un appareil</b><input required value={name} onChange={e=>setName(e.target.value)} placeholder="Nom" className="input"/><select value={type} onChange={e=>setType(e.target.value)} className="input bg-white"><option>Congélateur</option><option>Réfrigérateur</option></select><button className="w-full rounded-xl bg-cyan-600 p-3 font-semibold text-white">Ajouter</button></form></> }
function ProductRow({p,appliance,onEdit,onQty}) { return <div className="rounded-2xl bg-white p-4 shadow-sm"><button onClick={onEdit} className="w-full text-left"><b>{p.name}</b><small className="block text-slate-500">{appliance?.name} · {p.shelf} · {p.barcode||'Sans code'}</small></button><div className="mt-3 flex items-center justify-between border-t pt-3"><Badge date={p.expiry}/><div className="flex items-center gap-3"><button onClick={()=>onQty(p.id,-1)} className="rounded-lg bg-slate-100 px-3 py-1">−</button><b>{p.quantity} <small>{p.unit}</small></b><button onClick={()=>onQty(p.id,1)} className="rounded-lg bg-cyan-100 px-3 py-1 text-cyan-700">+</button></div></div></div> }
function ExpiryRow({p}) { return <div className="mb-2 flex items-center rounded-2xl bg-white p-3 shadow-sm"><span className="mr-3">⚠️</span><span className="flex-1"><b>{p.name}</b><small className="block text-slate-500">{p.quantity} {p.unit}</small></span><Badge date={p.expiry}/></div> }
function Badge({date}) { const d=daysLeft(date); return <span className={`rounded-lg px-2 py-1 text-[11px] ${d<0?'bg-red-100 text-red-700':d<=7?'bg-amber-100 text-amber-800':'bg-emerald-100 text-emerald-700'}`}>{d<0?`Périmé ${-d} j`:d===0?"Aujourd’hui":d<=7?`Dans ${d} j`:new Date(`${date}T00:00:00`).toLocaleDateString('fr-FR')}</span> }
function Stat({value,label}) { return <div className="rounded-2xl bg-white/15 p-2"><b className="block text-xl">{value}</b><small>{label}</small></div> }
function Action({primary,title,text,onClick}) { return <button onClick={onClick} className={`rounded-2xl p-4 text-left shadow-sm ${primary?'bg-cyan-600 text-white':'bg-white'}`}><span className="text-2xl">{primary?'▣':'+'}</span><b className="mt-2 block">{title}</b><small className={primary?'text-cyan-100':'text-slate-500'}>{text}</small></button> }
function Nav({active,onClick,icon,text}) { return <button onClick={onClick} className={`flex flex-col items-center text-xs ${active?'font-bold text-cyan-700':'text-slate-400'}`}><span className="text-xl">{icon}</span>{text}</button> }
function Chip({active,onClick,children}) { return <button onClick={onClick} className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs ${active?'bg-cyan-600 text-white':'border bg-white'}`}>{children}</button> }
function Field({label,children}) { return <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>{children}</label> }
function Empty({text}) { return <div className="rounded-2xl bg-white p-8 text-center text-slate-400">{text}</div> }
