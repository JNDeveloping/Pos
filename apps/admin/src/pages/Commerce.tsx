import { FormEvent, useEffect, useState } from 'react';
import { Calculator, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { api } from '../lib/api';
import { branchContext } from '../lib/branch-context';

type Row = { id: string; productId: string; cost?: string; salePrice: string; margin: string; product: { internalCode: string; name: string; category: { name: string }; brand?: { name: string }; barcodes: { barcode: string }[] } };
type Page = { data: Row[]; meta: { page: number; pages: number; total: number } };
type Preview = { productId: string; code: string; name: string; oldCost: string; newCost: string; oldPrice: string; newPrice: string; oldMargin: string; newMargin: string };
const money = (value: string | number | undefined) => `$ ${Number(value ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

export function Commerce({ kind }: { kind: 'prices' | 'costs' }) {
  const branchId = branchContext.get();
  const [result, setResult] = useState<Page>();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<Preview[]>([]);
  const [editing, setEditing] = useState<Row>();
  const [editValue, setEditValue] = useState('');
  const load = async () => { if (!branchId) return; setResult(await api<Page>(`/${kind}?branchId=${branchId}&search=${encodeURIComponent(search)}&page=${page}`)); };
  useEffect(() => { void load().catch((e) => setMessage(e.message)); }, [page, kind, branchId]);
  async function quick(row: Row) {
    setEditing(row); setEditValue(String(kind === 'prices' ? row.salePrice : row.cost ?? '0'));
  }
  async function saveQuick(event: FormEvent) {
    event.preventDefault(); if (!editing) return;
    await api(`/${kind}/${editing.productId}`, { method: 'PATCH', body: JSON.stringify({ branchId, value: editValue, keepMargin: kind === 'costs' }) });
    setEditing(undefined);
    setMessage('Cambio guardado con historial y auditoría.'); await load();
  }
  async function bulk(event: FormEvent<HTMLFormElement>, apply = false) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const body = { branchId, products: selected.map((productId) => ({ productId })), operation: form.get('operation'), value: form.get('value'), keepMargin: form.get('keepMargin') === 'on', roundingMode: form.get('roundingMode') };
    if (apply) { await api(`/${kind}/bulk/apply`, { method: 'POST', body: JSON.stringify(body) }); setPreview([]); setSelected([]); setMessage(`Se actualizaron ${preview.length} productos.`); await load(); }
    else setPreview(await api<Preview[]>(`/${kind}/bulk/preview`, { method: 'POST', body: JSON.stringify(body) }));
  }
  if (!branchId) return <p className="card p-6">Seleccioná una sucursal para administrar {kind === 'prices' ? 'precios' : 'costos'}.</p>;
  return <>
    <div><p className="text-xs font-bold tracking-widest text-brand-600">GESTIÓN COMERCIAL</p><h1 className="mt-2 text-3xl font-bold">{kind === 'prices' ? 'Precios' : 'Costos'}</h1><p className="mt-2 text-slate-500">Markup sobre costo: precio = costo × (1 + margen / 100).</p></div>
    {message && <p className="mt-4 rounded-xl bg-brand-50 p-4 text-brand-800">{message}</p>}
    <form className="card mt-6 flex gap-3 p-4" onSubmit={(e) => { e.preventDefault(); setPage(1); void load(); }}><Search className="self-center text-slate-400"/><input className="flex-1" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre, código o barcode"/><button className="btn-secondary">Buscar</button></form>
    {selected.length > 0 && <form className="card mt-4 grid gap-3 p-4 md:grid-cols-5" onSubmit={(e) => void bulk(e)}>
      <select name="operation"><option value="PERCENT">Aumentar %</option><option value="AMOUNT">Sumar monto</option>{kind === 'prices' && <option value="MARGIN">Aplicar margen</option>}</select>
      <input name="value" type="number" step="0.01" required placeholder="Valor"/>
      <select name="roundingMode"><option value="NONE">Sin redondeo</option><option value="MULTIPLE_10">Múltiplo de 10</option><option value="MULTIPLE_50">Múltiplo de 50</option><option value="MULTIPLE_100">Múltiplo de 100</option></select>
      {kind === 'costs' ? <label className="flex items-center gap-2"><input type="checkbox" name="keepMargin"/> Mantener margen</label> : <span/>}
      <button className="btn"><Calculator size={17}/> Previsualizar {selected.length}</button>
      {preview.length > 0 && <div className="md:col-span-5 overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['Producto','Costo anterior','Costo nuevo','Precio anterior','Precio nuevo','Margen nuevo'].map(x=><th className="p-2 text-left" key={x}>{x}</th>)}</tr></thead><tbody>{preview.map(x=><tr key={x.productId}><td className="p-2">{x.name}</td><td>{money(x.oldCost)}</td><td>{money(x.newCost)}</td><td>{money(x.oldPrice)}</td><td>{money(x.newPrice)}</td><td>{x.newMargin}%</td></tr>)}</tbody></table><button type="button" className="btn mt-3" onClick={(e) => void bulk({ preventDefault:()=>{}, currentTarget: e.currentTarget.closest('form')! } as unknown as FormEvent<HTMLFormElement>, true)}>Confirmar actualización de {preview.length} productos</button></div>}
    </form>}
    <div className="card mt-5 overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-sm"><thead className="border-b bg-slate-50"><tr><th className="p-4"></th>{['Código','Producto','Categoría','Marca','Costo','Precio','Margen','Acción'].map(x=><th className="p-4" key={x}>{x}</th>)}</tr></thead><tbody>{result?.data.map(row=><tr className="border-b" key={row.id}><td className="p-4"><input type="checkbox" checked={selected.includes(row.productId)} onChange={(e)=>setSelected(e.target.checked?[...selected,row.productId]:selected.filter(x=>x!==row.productId))}/></td><td className="p-4 font-mono">{row.product.internalCode}</td><td className="p-4 font-semibold">{row.product.name}<small className="block text-slate-400">{row.product.barcodes[0]?.barcode}</small></td><td className="p-4">{row.product.category.name}</td><td className="p-4">{row.product.brand?.name ?? '—'}</td><td className="p-4">{row.cost === undefined ? 'Restringido' : money(row.cost)}</td><td className="p-4 font-semibold">{money(row.salePrice)}</td><td className="p-4">{row.margin}%</td><td className="p-4"><button className="text-brand-700" onClick={()=>void quick(row)}>Cambio rápido</button></td></tr>)}</tbody></table><footer className="flex justify-between p-4"><span>{result?.meta.total ?? 0} productos</span><div className="flex gap-3"><button disabled={page<=1} onClick={()=>setPage(x=>x-1)}><ChevronLeft/></button><span>{page}/{result?.meta.pages||1}</span><button disabled={page>=(result?.meta.pages||1)} onClick={()=>setPage(x=>x+1)}><ChevronRight/></button></div></footer></div>
    {editing&&<div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"><form className="card w-full max-w-md p-6" onSubmit={saveQuick}><h2 className="text-xl font-bold">Cambio rápido de {kind==='prices'?'precio':'costo'}</h2><p className="mt-2 text-slate-500">{editing.product.name}</p><label className="mt-5 block font-semibold">Nuevo importe<input autoFocus className="mt-2 w-full" type="number" min="0" step="0.01" value={editValue} onChange={e=>setEditValue(e.target.value)} required/></label>{kind==='costs'&&<p className="mt-3 text-sm text-slate-500">El precio se recalculará manteniendo el margen actual.</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" className="btn-secondary" onClick={()=>setEditing(undefined)}>Cancelar</button><button className="btn">Guardar cambio</button></div></form></div>}
  </>;
}
