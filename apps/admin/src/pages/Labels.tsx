import { useEffect, useState } from 'react';
import { Check, Printer, Search } from 'lucide-react';
import { api } from '../lib/api';
import { branchContext } from '../lib/branch-context';
type Product={id:string;internalCode:string;name:string;barcodes:{barcode:string}[];branchConfigs:{branch:{id:string};salePrice:string}[]};
type Page={data:Product[]};
type Pending={id:string;oldPrice:string;newPrice:string;quantity:number;createdAt:string;product:Pick<Product,'id'|'name'|'internalCode'|'barcodes'>;user:{firstName:string;lastName:string};branch:{name:string}};
export function Labels(){
  const branchId=branchContext.get(), [tab,setTab]=useState<'catalog'|'pending'>('pending');
  const [products,setProducts]=useState<Product[]>([]),[pending,setPending]=useState<Pending[]>([]),[selected,setSelected]=useState<string[]>([]),[search,setSearch]=useState(''),[template,setTemplate]=useState('SHELF_SMALL');
  const load=()=>api<Page>(`/products?branchId=${branchId}&enabled=true&search=${encodeURIComponent(search)}&limit=50`).then(x=>setProducts(x.data));
  const loadPending=()=>api<Pending[]>(`/labels/pending?branchId=${branchId}`).then(setPending);
  useEffect(()=>{if(branchId)void Promise.all([load(),loadPending()])},[branchId]);
  const chosen=tab==='pending'?pending.filter(x=>selected.includes(x.id)):products.filter(x=>selected.includes(x.id));
  async function print(){if(!branchId||!chosen.length)return;if(tab==='catalog')await api('/labels/generated',{method:'POST',body:JSON.stringify({branchId,productIds:selected,template})});await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));window.print()}
  async function markPrinted(){await api('/labels/pending/printed',{method:'POST',body:JSON.stringify({ids:selected})});setSelected([]);await loadPending()}
  return <>
    <div className="no-print"><h1 className="text-3xl font-bold">Etiquetas y carteles</h1><p className="mt-2 text-slate-500">Imprimí etiquetas del catálogo o resolvé cambios de precio pendientes.</p>
      <div className="mt-5 flex gap-2"><button className={tab==='pending'?'btn':'btn-secondary'} onClick={()=>{setTab('pending');setSelected([])}}>Cambios pendientes <span className="badge">{pending.length}</span></button><button className={tab==='catalog'?'btn':'btn-secondary'} onClick={()=>{setTab('catalog');setSelected([])}}>Buscar productos</button></div>
      <div className="card mt-4 grid gap-3 p-4 md:grid-cols-[1fr_220px_auto_auto]">
        {tab==='catalog'?<label className="flex gap-2"><Search className="self-center"/><input className="flex-1" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar producto"/><button className="btn-secondary" onClick={()=>void load()}>Buscar</button></label>:<p className="self-center text-sm text-slate-500">{pending.length} cambios esperan impresión</p>}
        <select value={template} onChange={e=>setTemplate(e.target.value)}><option value="SHELF_SMALL">Góndola pequeña</option><option value="SHELF_LARGE">Góndola grande</option><option value="A5_OFFER">A5 oferta</option><option value="A4_OFFER">A4 oferta</option></select>
        <button className="btn" disabled={!selected.length} onClick={()=>void print()}><Printer size={18}/>Vista previa / imprimir {selected.length}</button>
        {tab==='pending'&&<button className="btn-secondary" disabled={!selected.length} onClick={()=>void markPrinted()}><Check size={18}/>Marcar impresas</button>}
      </div>
      <div className="card mt-4 divide-y">{tab==='pending'?pending.map(row=><label className="flex min-h-16 items-center gap-3 p-4" key={row.id}><input type="checkbox" checked={selected.includes(row.id)} onChange={e=>setSelected(e.target.checked?[...selected,row.id]:selected.filter(x=>x!==row.id))}/><div className="min-w-0 flex-1"><b className="block truncate">{row.product.name}</b><small className="text-slate-500">{row.branch.name} · {row.user.firstName} {row.user.lastName} · {new Date(row.createdAt).toLocaleString('es-AR')}</small></div><span className="text-sm text-slate-400 line-through">$ {Number(row.oldPrice).toLocaleString('es-AR')}</span><strong>$ {Number(row.newPrice).toLocaleString('es-AR')}</strong></label>):products.map(p=><label className="flex min-h-14 items-center gap-3 p-4" key={p.id}><input type="checkbox" checked={selected.includes(p.id)} disabled={!selected.includes(p.id)&&selected.length>=50} onChange={e=>setSelected(e.target.checked?[...selected,p.id]:selected.filter(x=>x!==p.id))}/><span className="font-mono text-sm">{p.internalCode}</span><b className="flex-1">{p.name}</b><span>$ {Number(p.branchConfigs.find(x=>x.branch.id===branchId)?.salePrice??0).toLocaleString('es-AR')}</span></label>)}</div>
    </div>
    <section className={`print-grid label-template-${template.toLowerCase()}`}>{chosen.flatMap(item=>{const queued='product'in item,p=queued?item.product:item,price=queued?item.newPrice:(item as Product).branchConfigs.find(x=>x.branch.id===branchId)?.salePrice,quantity=queued?item.quantity:1;return Array.from({length:quantity},(_,index)=><article className="print-label" key={`${item.id}-${index}`}>{template.includes('OFFER')&&<strong className="offer">OFERTA</strong>}<h2>{p.name}</h2><b className="price">$ {Number(price??0).toLocaleString('es-AR')}</b><p>{p.barcodes[0]?.barcode}</p><small>{p.internalCode} · {new Date().toLocaleDateString('es-AR')}</small></article>)})}</section>
  </>;
}
