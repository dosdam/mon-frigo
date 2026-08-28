import { useEffect, useMemo, useRef, useState } from 'react';
import Scanner from './components/Scanner.jsx';
import { findFood } from './services/openFoodFacts.js';
import {
  isFirebaseReady,
  saveHouseholdData,
  signInToCloud,
  subscribeToHousehold,
} from './services/firebase.js';

const initialAppliances = [
  { id: 'f1', name: 'Congélateur cuisine', type: 'Congélateur', shelves: [{id:'s1',name:'Tiroir 1'},{id:'s2',name:'Tiroir 2'},{id:'s3',name:'Tiroir 3'}] },
  { id: 'f2', name: 'Réfrigérateur', type: 'Réfrigérateur', shelves: [{id:'s4',name:'Étage haut'},{id:'s5',name:'Étage milieu'},{id:'s6',name:'Bac à légumes'},{id:'s7',name:'Porte'}] }
];
const householdKey = 'householdId';
const load = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } };
const days = d => Math.ceil((new Date(`${d}T00:00:00`) - new Date().setHours(0,0,0,0)) / 864e5);
const uid = prefix => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const sanitizeHousehold = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').slice(0, 64);
const serializeCloudData = payload => JSON.stringify(payload);

function normalizeAppliances(list) {
  return list.map(a => ({...a, type:a.type || 'Congélateur', shelves:(a.shelves || []).map(s => typeof s === 'string' ? {id:uid('s'),name:s} : s)}));
}
function migrateProducts(list, appliances) {
  return list.map(p => {
    if (p.shelfId) return p;
    const appliance = appliances.find(a => a.id === p.applianceId);
    const shelf = appliance?.shelves.find(s => s.name === p.shelf) || appliance?.shelves[0];
    return {...p, shelfId:shelf?.id || ''};
  });
}

export default function App() {
  const [appliances, setAppliances] = useState(() => normalizeAppliances(load('appliances', initialAppliances)));
  const [products, setProducts] = useState(() => migrateProducts(load('products', []), normalizeAppliances(load('appliances', initialAppliances))));
  const [householdId, setHouseholdId] = useState(() => sanitizeHousehold(localStorage.getItem(householdKey) || 'famille-congelateur'));
  const [syncMessage, setSyncMessage] = useState(() => isFirebaseReady ? 'Connexion au cloud…' : 'Cloud inactif (configuration Firebase manquante)');
  const [syncError, setSyncError] = useState('');
  const [tab, setTab] = useState('home');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [drawerView, setDrawerView] = useState(null);
  const appliancesRef = useRef(appliances);
  const productsRef = useRef(products);
  const cloudReadyRef = useRef(false);
  const lastCloudHashRef = useRef('');

  useEffect(() => localStorage.setItem('appliances', JSON.stringify(appliances)), [appliances]);
  useEffect(() => localStorage.setItem('products', JSON.stringify(products)), [products]);
  useEffect(() => { appliancesRef.current = appliances; }, [appliances]);
  useEffect(() => { productsRef.current = products; }, [products]);
  useEffect(() => {
    if (householdId) localStorage.setItem(householdKey, householdId);
  }, [householdId]);

  useEffect(() => {
    if (!isFirebaseReady) return;
    let isMounted = true;
    let unsubscribe = () => {};

    setSyncError('');
    setSyncMessage('Connexion au cloud…');
    cloudReadyRef.current = false;

    async function connect() {
      try {
        await signInToCloud();
        if (!isMounted) return;
        setSyncMessage(`Cloud connecté (${householdId})`);

        unsubscribe = subscribeToHousehold(
          householdId,
          async remote => {
            if (!isMounted) return;

            if (!remote) {
              const payload = { appliances: appliancesRef.current, products: productsRef.current };
              const hash = serializeCloudData(payload);
              await saveHouseholdData(householdId, payload);
              lastCloudHashRef.current = hash;
              cloudReadyRef.current = true;
              setSyncMessage(`Cloud initialisé (${householdId})`);
              return;
            }

            const nextAppliances = normalizeAppliances(remote.appliances || initialAppliances);
            const nextProducts = migrateProducts(remote.products || [], nextAppliances);
            const remotePayload = { appliances: nextAppliances, products: nextProducts };
            const remoteHash = serializeCloudData(remotePayload);
            const localHash = serializeCloudData({ appliances: appliancesRef.current, products: productsRef.current });

            lastCloudHashRef.current = remoteHash;
            cloudReadyRef.current = true;

            if (remoteHash !== localHash) {
              setAppliances(nextAppliances);
              setProducts(nextProducts);
            }

            setSyncMessage(`Cloud synchronisé (${householdId})`);
          },
          error => {
            if (!isMounted) return;
            setSyncError(error.message || 'Erreur inconnue Firebase');
            setSyncMessage('Erreur de synchronisation cloud');
          }
        );
      } catch (error) {
        if (!isMounted) return;
        setSyncError(error.message || 'Connexion Firebase impossible');
        setSyncMessage('Cloud indisponible');
      }
    }

    connect();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [householdId]);

  useEffect(() => {
    if (!isFirebaseReady || !cloudReadyRef.current) return;

    const payload = { appliances, products };
    const nextHash = serializeCloudData(payload);
    if (nextHash === lastCloudHashRef.current) return;

    let cancelled = false;
    setSyncMessage(`Synchronisation cloud (${householdId})…`);

    saveHouseholdData(householdId, payload)
      .then(() => {
        if (cancelled) return;
        lastCloudHashRef.current = nextHash;
        setSyncError('');
        setSyncMessage(`Cloud synchronisé (${householdId})`);
      })
      .catch(error => {
        if (cancelled) return;
        setSyncError(error.message || 'Erreur d\'écriture Firebase');
        setSyncMessage('Erreur de synchronisation cloud');
      });

    return () => {
      cancelled = true;
    };
  }, [appliances, products, householdId]);

  const shown = useMemo(() => products.filter(p =>
    (filter === 'all' || p.applianceId === filter) &&
    `${p.name} ${p.barcode}`.toLowerCase().includes(search.toLowerCase())
  ), [products, filter, search]);

  async function scanned(code) {
    const local = products.find(p => p.barcode === code);
    if (local) return setModal({type:'form', product:local});
    setModal({type:'loading', code});
    try { setModal({type:'form', product:null, code, off:await findFood(code)}); }
    catch (e) { setModal({type:'form', product:null, code, error:e.message}); }
  }
  function save(product) {
    setProducts(list => product.id ? list.map(p => p.id === product.id ? product : p) : [{...product,id:uid('p')},...list]);
    setModal(null);
  }
  function openShelf(appliance, shelf) { setDrawerView({applianceId:appliance.id,shelfId:shelf.id}); setTab('drawers'); }

  return <div className="mx-auto min-h-screen max-w-md bg-slate-50 pb-24 shadow-xl">
    <header className="rounded-b-[2rem] bg-gradient-to-br from-cyan-600 to-blue-700 px-5 pb-6 pt-8 text-white">
      <p className="text-sm text-cyan-100">Inventaire intelligent</p><h1 className="text-2xl font-bold">❄ Mon Congélateur</h1>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">{[[products.length,'produits'],[products.reduce((n,p)=>n+Number(p.quantity),0),'quantité'],[products.filter(p=>days(p.expiry)<=7).length,'à surveiller']].map(x=><div className="rounded-xl bg-white/15 p-2" key={x[1]}><b className="block text-xl">{x[0]}</b><small>{x[1]}</small></div>)}</div>
    </header>

    <main className="space-y-4 p-4">
      {tab === 'home' && <Home appliances={appliances} products={products} scan={()=>setModal({type:'scan'})} add={()=>setModal({type:'form',product:null,code:''})} openShelf={openShelf}/>} 
      {tab === 'stock' && <Stock appliances={appliances} products={shown} filter={filter} setFilter={setFilter} search={search} setSearch={setSearch} edit={p=>setModal({type:'form',product:p})}/>} 
      {tab === 'dates' && <Dates products={products}/>} 
      {tab === 'settings' && <Settings appliances={appliances} setAppliances={setAppliances} products={products} householdId={householdId} setHouseholdId={setHouseholdId} syncMessage={syncMessage} syncError={syncError}/>} 
      {tab === 'drawers' && <DrawerView appliances={appliances} products={products} selection={drawerView} setSelection={setDrawerView} edit={p=>setModal({type:'form',product:p})}/>} 
    </main>

    <button onClick={()=>setModal({type:'scan'})} className="fixed bottom-16 left-1/2 z-20 h-16 w-16 -translate-x-1/2 rounded-full border-4 border-white bg-cyan-600 text-2xl text-white">▣</button>
    <nav className="fixed bottom-0 left-1/2 flex h-20 w-full max-w-md -translate-x-1/2 justify-around border-t bg-white pt-3">
      <Nav icon="⌂" text="Accueil" onClick={()=>setTab('home')}/><Nav icon="□" text="Stock" onClick={()=>setTab('stock')}/><span className="w-10"/><Nav icon="▤" text="Tiroirs" onClick={()=>setTab('drawers')}/><Nav icon="⚙" text="Réglages" onClick={()=>setTab('settings')}/>
    </nav>

    {modal && <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/60"><div className="safe max-h-[92vh] w-full max-w-md overflow-auto rounded-t-[2rem] bg-slate-50 p-5">
      {modal.type === 'scan' ? <Scanner onScan={scanned} onClose={()=>setModal(null)}/> : modal.type === 'loading' ? <Loading/> : <ProductForm appliances={appliances} product={modal.product} code={modal.code} off={modal.off} error={modal.error} save={save} close={()=>setModal(null)} remove={modal.product?()=>{setProducts(x=>x.filter(p=>p.id!==modal.product.id));setModal(null)}:null}/>} 
    </div></div>}
  </div>;
}

function Home({appliances,products,scan,add,openShelf}) { return <>
  <div className="grid grid-cols-2 gap-3"><Action primary text="Scanner" onClick={scan}/><Action text="Ajouter" onClick={add}/></div>
  <h2 className="text-lg font-bold">Vue par emplacement</h2>
  {appliances.map(a=><section key={a.id} className="rounded-2xl bg-white p-4 shadow-sm"><div className="mb-3 flex justify-between"><b>{a.name}</b><small className="text-slate-500">{a.shelves.length} emplacement(s)</small></div><div className="grid grid-cols-2 gap-2">{a.shelves.map(s=>{const count=products.filter(p=>p.applianceId===a.id&&p.shelfId===s.id).length;return <button key={s.id} onClick={()=>openShelf(a,s)} className="rounded-xl border border-cyan-100 bg-cyan-50 p-3 text-left"><span className="text-lg">▤</span><b className="block truncate text-sm">{s.name}</b><small className="text-slate-500">{count} produit(s)</small></button>})}</div></section>)}
</> }

function DrawerView({appliances,products,selection,setSelection,edit}) {
  const appliance = appliances.find(a=>a.id===selection?.applianceId) || appliances[0];
  const shelf = appliance?.shelves.find(s=>s.id===selection?.shelfId) || appliance?.shelves[0];
  const list = products.filter(p=>p.applianceId===appliance?.id&&p.shelfId===shelf?.id);
  return <><h2 className="text-xl font-bold">Vue par tiroir</h2><select className="input bg-white" value={appliance?.id||''} onChange={e=>{const a=appliances.find(x=>x.id===e.target.value);setSelection({applianceId:a.id,shelfId:a.shelves[0]?.id})}}>{appliances.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select><div className="flex gap-2 overflow-auto">{appliance?.shelves.map(s=><Chip key={s.id} active={s.id===shelf?.id} click={()=>setSelection({applianceId:appliance.id,shelfId:s.id})}>{s.name}</Chip>)}</div><div className="rounded-2xl bg-gradient-to-b from-cyan-50 to-white p-4 shadow-inner"><div className="mb-3 flex justify-between"><b>▤ {shelf?.name}</b><span className="rounded-full bg-cyan-100 px-2 py-1 text-xs">{list.length} produit(s)</span></div>{list.length?list.map(p=><ProductRow key={p.id} p={p} edit={edit}/>):<Empty text="Cet emplacement est vide"/>}</div></>;
}

function Settings({appliances,setAppliances,products,householdId,setHouseholdId,syncMessage,syncError}) {
  const [newNames,setNewNames]=useState({});
  const [newHousehold,setNewHousehold]=useState(householdId);
  useEffect(()=>setNewHousehold(householdId),[householdId]);
  function addShelf(applianceId){const name=(newNames[applianceId]||'').trim();if(!name)return;setAppliances(list=>list.map(a=>a.id===applianceId?{...a,shelves:[...a.shelves,{id:uid('s'),name}]}:a));setNewNames(x=>({...x,[applianceId]:''}))}
  function renameShelf(applianceId,shelfId){const current=appliances.find(a=>a.id===applianceId)?.shelves.find(s=>s.id===shelfId);const name=window.prompt('Nouveau nom de l’emplacement',current?.name||'')?.trim();if(!name)return;setAppliances(list=>list.map(a=>a.id===applianceId?{...a,shelves:a.shelves.map(s=>s.id===shelfId?{...s,name}:s)}:a))}
  function deleteShelf(applianceId,shelfId){if(products.some(p=>p.applianceId===applianceId&&p.shelfId===shelfId)){window.alert('Impossible : déplacez ou supprimez d’abord les produits de cet emplacement.');return}setAppliances(list=>list.map(a=>a.id===applianceId?{...a,shelves:a.shelves.filter(s=>s.id!==shelfId)}:a))}
  function connectHousehold(){
    const clean = sanitizeHousehold(newHousehold);
    if(!clean){window.alert('Saisissez un identifiant de foyer valide.');return}
    setHouseholdId(clean);
  }
  return <><h2 className="text-xl font-bold">Réglages</h2>
    <section className="mb-4 space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      <b className="block">Synchronisation cloud (Firebase)</b>
      <small className="block text-slate-600">Utilisez le même identifiant de foyer sur les deux téléphones pour partager la même liste.</small>
      <div className="flex gap-2">
        <input value={newHousehold} onChange={e=>setNewHousehold(e.target.value)} placeholder="Ex: famille-dupont" className="input min-w-0 flex-1"/>
        <button onClick={connectHousehold} className="rounded-xl bg-cyan-600 px-4 font-bold text-white">Connecter</button>
      </div>
      <small className="block rounded-xl bg-slate-100 p-3 text-slate-700">{syncMessage}</small>
      {syncError && <small className="block rounded-xl bg-red-50 p-3 text-red-700">{syncError}</small>}
      {!isFirebaseReady && <small className="block rounded-xl bg-amber-50 p-3 text-amber-700">Ajoutez les variables VITE_FIREBASE_* dans un fichier .env pour activer la synchro.</small>}
    </section>
    <h2 className="text-xl font-bold">Gérer les emplacements</h2>{appliances.map(a=><section key={a.id} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm"><div><b>{a.name}</b><small className="block text-slate-500">{a.type}</small></div>{a.shelves.map(s=><div key={s.id} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3"><span className="flex-1"><b className="text-sm">{s.name}</b><small className="block text-slate-500">{products.filter(p=>p.applianceId===a.id&&p.shelfId===s.id).length} produit(s)</small></span><button onClick={()=>renameShelf(a.id,s.id)} className="rounded-lg border px-2 py-1 text-sm">Renommer</button><button onClick={()=>deleteShelf(a.id,s.id)} className="rounded-lg border border-red-200 px-2 py-1 text-sm text-red-600">×</button></div>)}<div className="flex gap-2"><input value={newNames[a.id]||''} onChange={e=>setNewNames(x=>({...x,[a.id]:e.target.value}))} placeholder="Nouveau tiroir ou emplacement" className="input min-w-0 flex-1"/><button onClick={()=>addShelf(a.id)} className="rounded-xl bg-cyan-600 px-4 font-bold text-white">+</button></div></section>)}</>;
}

function Stock({appliances,products,filter,setFilter,search,setSearch,edit}) { return <><h2 className="text-xl font-bold">Stock</h2><input className="input" placeholder="Rechercher" value={search} onChange={e=>setSearch(e.target.value)}/><div className="flex gap-2 overflow-auto"><Chip active={filter==='all'} click={()=>setFilter('all')}>Tout</Chip>{appliances.map(a=><Chip key={a.id} active={filter===a.id} click={()=>setFilter(a.id)}>{a.name}</Chip>)}</div>{products.length?products.map(p=><ProductRow key={p.id} p={p} edit={edit}/>):<Empty text="Aucun produit"/>}</> }
function Dates({products}) { return <><h2 className="text-xl font-bold">Péremption</h2>{[...products].sort((a,b)=>a.expiry.localeCompare(b.expiry)).map(p=><div key={p.id} className="flex rounded-xl bg-white p-3"><b className="flex-1">{p.name}</b><Badge date={p.expiry}/></div>)}</> }
function ProductRow({p,edit}) { return <button onClick={()=>edit(p)} className="mb-2 flex w-full items-center gap-3 rounded-xl bg-white p-3 text-left shadow-sm">{p.imageUrl&&<img src={p.imageUrl} className="h-12 w-12 rounded-lg object-contain"/>}<span className="flex-1"><b>{p.name}</b><small className="block text-slate-500">Quantité : {p.quantity}</small></span><Badge date={p.expiry}/></button> }

function ProductForm({appliances,product,code,off,error,save,close,remove}) {
  const a0=appliances[0]; const [f,setF]=useState(product||{name:off?.name||'',barcode:code||'',quantity:1,applianceId:a0?.id||'',shelfId:a0?.shelves[0]?.id||'',expiry:new Date(Date.now()+30*864e5).toISOString().slice(0,10),imageUrl:off?.imageUrl||'',source:off?.source||''});
  const appliance=appliances.find(a=>a.id===f.applianceId)||a0; const set=(k,v)=>setF(x=>({...x,[k]:v}));
  return <form onSubmit={e=>{e.preventDefault();save(f)}} className="space-y-3"><div className="flex justify-between"><h2 className="text-xl font-bold">{product?'Modifier':'Ajouter'}</h2><button type="button" onClick={close}>✕</button></div>{off?.imageUrl&&<img src={off.imageUrl} className="mx-auto h-32 object-contain"/>}{off&&<p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">✓ Trouvé sur Open Food Facts{off.packageQuantity&&` · ${off.packageQuantity}`}</p>}{!off&&code&&<p className="rounded-xl bg-amber-50 p-3 text-sm">{error||'Produit non trouvé. Saisie manuelle possible.'}</p>}<Field label="Nom"><input required className="input" value={f.name} onChange={e=>set('name',e.target.value)}/></Field><Field label="Code-barres"><input className="input" value={f.barcode} onChange={e=>set('barcode',e.target.value)}/></Field><Field label="Quantité"><input required type="number" min="1" className="input" value={f.quantity} onChange={e=>set('quantity',+e.target.value)}/></Field><Field label="Appareil"><select className="input bg-white" value={f.applianceId} onChange={e=>{const a=appliances.find(x=>x.id===e.target.value);setF(x=>({...x,applianceId:a.id,shelfId:a.shelves[0]?.id||''}))}}>{appliances.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></Field><Field label="Tiroir / emplacement"><select required className="input bg-white" value={f.shelfId} onChange={e=>set('shelfId',e.target.value)}>{appliance?.shelves.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field><Field label="Date de péremption"><input required type="date" className="input" value={f.expiry} onChange={e=>set('expiry',e.target.value)}/></Field><button className="w-full rounded-xl bg-cyan-600 p-3 font-bold text-white">Enregistrer</button>{remove&&<button type="button" onClick={remove} className="w-full rounded-xl border border-red-200 p-3 text-red-600">Supprimer</button>}</form>;
}
function Loading(){return <div className="py-10 text-center"><div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-cyan-100 border-t-cyan-600"/><b className="mt-4 block">Recherche Open Food Facts…</b></div>}
function Field({label,children}){return <label className="block"><small className="mb-1 block font-medium">{label}</small>{children}</label>}
function Action({primary,text,onClick}){return <button onClick={onClick} className={`rounded-2xl p-5 text-left shadow ${primary?'bg-cyan-600 text-white':'bg-white'}`}><span className="text-2xl">{primary?'▣':'+'}</span><b className="block">{text}</b></button>}
function Chip({active,click,children}){return <button onClick={click} className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs ${active?'bg-cyan-600 text-white':'border bg-white'}`}>{children}</button>}
function Badge({date}){const d=days(date);return <small className={`rounded-lg px-2 py-1 ${d<0?'bg-red-100 text-red-700':d<=7?'bg-amber-100':'bg-emerald-100 text-emerald-700'}`}>{d<0?'Périmé':d<=7?`Dans ${d} j`:new Date(`${date}T00:00:00`).toLocaleDateString('fr-FR')}</small>}
function Nav({icon,text,onClick}){return <button onClick={onClick}>{icon}<small className="block">{text}</small></button>}
function Empty({text}){return <div className="rounded-xl bg-white p-6 text-center text-sm text-slate-400">{text}</div>}
