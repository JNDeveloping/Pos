import { FormEvent, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../lib/api';
type List = { id: string; code: string; name: string; description?: string; active: boolean; isDefault: boolean; _count: { items: number } };
export function PriceLists() {
  const [lists, setLists] = useState<List[]>([]), [message, setMessage] = useState('');
  const load = () => api<List[]>('/price-lists').then(setLists).catch((e)=>setMessage(e.message));
  useEffect(()=>{void load()},[]);
  async function create(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const f=new FormData(e.currentTarget); await api('/price-lists',{method:'POST',body:JSON.stringify({name:f.get('name'),code:f.get('code'),description:f.get('description'),isDefault:f.get('isDefault')==='on'})}); e.currentTarget.reset(); setMessage('Lista creada correctamente.'); await load(); }
  return <><h1 className="text-3xl font-bold">Listas de precios</h1><p className="mt-2 text-slate-500">BranchProduct.salePrice continúa siendo el precio minorista efectivo. Las listas permiten incorporar políticas adicionales gradualmente.</p>{message&&<p className="mt-4 rounded-xl bg-brand-50 p-4">{message}</p>}<form className="card mt-6 grid gap-3 p-5 md:grid-cols-4" onSubmit={create}><input name="name" required placeholder="Nombre"/><input name="code" required placeholder="Código"/><input name="description" placeholder="Descripción"/><button className="btn"><Plus size={17}/>Crear</button><label className="flex items-center gap-2"><input type="checkbox" name="isDefault"/> Predeterminada</label></form><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{lists.map(list=><article className="card p-5" key={list.id}><div className="flex justify-between"><b>{list.name}</b>{list.isDefault&&<span className="badge">Predeterminada</span>}</div><p className="mt-1 font-mono text-sm text-slate-500">{list.code}</p><p className="mt-3 text-sm">{list.description||'Sin descripción'}</p><p className="mt-4 text-sm text-slate-500">{list._count.items} precios específicos</p></article>)}</div></>;
}
