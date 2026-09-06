import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, ImagePlus, Plus, Save, Trash2, X } from 'lucide-react';
import { branchContext } from '../lib/branch-context';
import { api } from '../lib/api';
import { API } from '../lib/api';
import { DEFAULT_POS_SETTINGS, type PosSettings } from '../lib/pos-settings';

const tabs = ['GENERAL', 'APARIENCIA', 'POS', 'PRODUCTOS', 'STOCK', 'TICKETS'] as const;
type Tab = (typeof tabs)[number];
type Appearance = {
  systemName: string;
  primaryColor: string;
  background?: string;
  backgroundOpacity: number;
  backgroundOverlay: string;
  backgroundBlur: number;
  backgroundPosition: string;
  defaultTax: number;
  defaultMargin: number;
  defaultMinimum: number;
};
type ProductOption = { id: string; name: string; internalCode: string };
type QuickGroup = {
  id: string;
  name: string;
  icon: string;
  sortOrder: number;
  buttonSize: string;
  active: boolean;
  items: { product: ProductOption }[];
};
const defaults: Appearance = {
  systemName: 'El Rincón de los Nietos', primaryColor: '#16a34a', backgroundOpacity: 28,
  backgroundOverlay: '#020617', backgroundBlur: 0, backgroundPosition: 'center', defaultTax: 21,
  defaultMargin: 30, defaultMinimum: 5,
};

export function Settings() {
  const branchId = branchContext.get();
  const [tab, setTab] = useState<Tab>('GENERAL');
  const [prefs, setPrefs] = useState(defaults);
  const [pos, setPos] = useState<PosSettings>(DEFAULT_POS_SETTINGS);
  const [groups, setGroups] = useState<QuickGroup[]>([]);
  const [editing, setEditing] = useState<Partial<QuickGroup> & { productIds: string[] }>();
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [message, setMessage] = useState('');

  const loadGroups = async () => {
    if (!branchId) return;
    setGroups(await api(`/pos-quick-groups?branchId=${branchId}`));
  };
  useEffect(() => {
    void api<{ appearance?: Partial<Appearance>; pos?: PosSettings }>(`/settings${branchId ? `?branchId=${branchId}` : ''}`)
      .then((data) => { setPrefs({ ...defaults, ...data.appearance }); setPos({ ...DEFAULT_POS_SETTINGS, ...data.pos }); });
    void loadGroups();
  }, [branchId]);

  const save = async () => {
    await api(`/settings${branchId ? `?branchId=${branchId}` : ''}`, { method: 'PUT', body: JSON.stringify({ appearance: prefs, pos }) });
    setMessage('Configuración guardada en el servidor. Ya está disponible para las demás terminales.');
  };
  const upload = async (file?: File) => {
    if (!file) return;
    const body = new FormData(); body.append('file', file);
    const result = await api<{ url: string }>('/settings/pos-background', { method: 'POST', body });
    setPrefs((current) => ({ ...current, background: result.url }));
  };
  const searchProducts = async () => {
    if (!branchId || productSearch.trim().length < 2) return;
    const page = await api<{ data: ProductOption[] }>(`/products?branchId=${branchId}&enabled=true&limit=12&search=${encodeURIComponent(productSearch)}`);
    setProductOptions(page.data);
  };
  const saveGroup = async () => {
    if (!branchId || !editing?.name?.trim()) return;
    const payload = { branchId, name: editing.name, icon: editing.icon || '◉', sortOrder: editing.sortOrder ?? groups.length, buttonSize: editing.buttonSize || 'MEDIUM', active: editing.active ?? true, productIds: editing.productIds };
    await api(editing.id ? `/pos-quick-groups/${editing.id}` : '/pos-quick-groups', { method: editing.id ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
    setEditing(undefined); setProductOptions([]); setProductSearch(''); await loadGroups();
  };
  const moveGroup = async (index: number, direction: -1 | 1) => {
    const other = groups[index + direction]; if (!branchId || !other) return;
    const current = groups[index];
    const update = (group: QuickGroup, sortOrder: number) => api(`/pos-quick-groups/${group.id}`, { method: 'PATCH', body: JSON.stringify({ branchId, name: group.name, icon: group.icon, sortOrder, buttonSize: group.buttonSize, active: group.active, productIds: group.items.map((item) => item.product.id) }) });
    await Promise.all([update(current, other.sortOrder), update(other, current.sortOrder)]); await loadGroups();
  };

  return <div className="space-y-5">
    <header className="page-heading"><div><p className="eyebrow">CENTRO DE CONTROL</p><h1>Configuración</h1><p>Personalizá la operación sin depender de este navegador.</p></div><button className="btn-primary" onClick={() => void save()}><Save size={17}/>Guardar</button></header>
    {message && <p className="rounded-xl bg-emerald-50 p-3 text-emerald-800">{message}</p>}
    <nav className="settings-tabs">{tabs.map((item) => <button className={tab === item ? 'active' : ''} key={item} onClick={() => setTab(item)}>{item}</button>)}</nav>
    <section className="card settings-panel">
      {tab === 'GENERAL' && <><Field label="Nombre del sistema" value={prefs.systemName} set={(systemName) => setPrefs({ ...prefs, systemName })}/><p className="setting-help">Los datos fiscales y de sucursal se administran desde la ficha de Sucursales.</p></>}
      {tab === 'APARIENCIA' && <>
        <label>Color principal<input type="color" value={prefs.primaryColor} onChange={(e) => setPrefs({ ...prefs, primaryColor: e.target.value })}/></label>
        <label className="setting-upload"><ImagePlus/> Fondo del POS<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => void upload(e.target.files?.[0])}/></label>
        {prefs.background && <div className="pos-background-preview" style={{ backgroundImage: `linear-gradient(${prefs.backgroundOverlay}${Math.round(prefs.backgroundOpacity * 2.55).toString(16).padStart(2, '0')}, ${prefs.backgroundOverlay}${Math.round(prefs.backgroundOpacity * 2.55).toString(16).padStart(2, '0')}), url(${prefs.background.startsWith('/api') ? `${API.replace(/\/api$/, '')}${prefs.background}` : prefs.background})`, backgroundPosition: prefs.backgroundPosition }}><button onClick={() => setPrefs({ ...prefs, background: undefined })}><X/>Quitar</button></div>}
        <Range label={`Oscurecimiento ${prefs.backgroundOpacity}%`} min={0} max={80} value={prefs.backgroundOpacity} set={(backgroundOpacity) => setPrefs({ ...prefs, backgroundOpacity })}/>
        <Range label={`Desenfoque ${prefs.backgroundBlur}px`} min={0} max={12} value={prefs.backgroundBlur} set={(backgroundBlur) => setPrefs({ ...prefs, backgroundBlur })}/>
        <label>Posición<select value={prefs.backgroundPosition} onChange={(e) => setPrefs({ ...prefs, backgroundPosition: e.target.value })}><option value="center">Centro</option><option value="top">Arriba</option><option value="bottom">Abajo</option><option value="left">Izquierda</option><option value="right">Derecha</option></select></label>
      </>}
      {tab === 'POS' && <div className="md:col-span-2 space-y-5">
        {!branchId ? <p>Seleccioná una sucursal para configurar el POS.</p> : <>
          <div className="grid gap-4 md:grid-cols-3"><label>Modo<select value={pos.mode} onChange={(e) => setPos({ ...pos, mode: e.target.value as PosSettings['mode'] })}><option value="touch">Táctil</option><option value="compact">Compacto</option></select></label><NumberField label="Columnas de botones" value={pos.favoriteColumns} set={(favoriteColumns) => setPos({ ...pos, favoriteColumns })}/><label className="check-field"><input type="checkbox" checked={pos.showStock} onChange={(e) => setPos({ ...pos, showStock: e.target.checked })}/>Mostrar stock</label></div>
          <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">Grupos táctiles</h2><p className="text-sm text-slate-500">Un toque abre el grupo; otro agrega el producto o solicita peso.</p></div><button className="btn" onClick={() => setEditing({ name: '', icon: '◉', active: true, buttonSize: 'MEDIUM', sortOrder: groups.length, productIds: [] })}><Plus/>Nuevo grupo</button></div>
          <div className="quick-group-editor-list">{groups.map((group, index) => <article key={group.id}><span className="text-2xl">{group.icon}</span><div><b>{group.name}</b><small>{group.items.length} productos · botón {group.buttonSize.toLowerCase()}</small></div><button disabled={index === 0} title="Subir" onClick={() => void moveGroup(index, -1)}><ChevronUp/></button><button disabled={index === groups.length - 1} title="Bajar" onClick={() => void moveGroup(index, 1)}><ChevronDown/></button><button onClick={() => setEditing({ ...group, productIds: group.items.map((item) => item.product.id) })}>Editar</button><button className="text-red-700" onClick={async () => { if (confirm(`¿Eliminar ${group.name}?`)) { await api(`/pos-quick-groups/${group.id}`, { method: 'DELETE' }); await loadGroups(); } }}><Trash2/></button></article>)}</div>
        </>}
      </div>}
      {tab === 'PRODUCTOS' && <><NumberField label="IVA predeterminado" value={prefs.defaultTax} set={(defaultTax) => setPrefs({ ...prefs, defaultTax })}/><NumberField label="Margen predeterminado" value={prefs.defaultMargin} set={(defaultMargin) => setPrefs({ ...prefs, defaultMargin })}/></>}
      {tab === 'STOCK' && <><NumberField label="Stock mínimo predeterminado" value={prefs.defaultMinimum} set={(defaultMinimum) => setPrefs({ ...prefs, defaultMinimum })}/><p className="setting-help">Los saldos Local/Depósito se guardan por sucursal; la reposición interna se incorporará en la pantalla Stock.</p></>}
      {tab === 'TICKETS' && <p className="setting-help">Encabezado, pie, ancho e información fiscal se configuran desde la ficha de cada sucursal.</p>}
    </section>
    {editing && <div className="modal-backdrop"><section className="modal-card max-w-2xl"><header className="flex justify-between"><div><h2 className="text-xl font-bold">{editing.id ? 'Editar grupo' : 'Nuevo grupo táctil'}</h2><p className="text-sm text-slate-500">Elegí y ordená los productos para trabajar con uno o dos toques.</p></div><button onClick={() => setEditing(undefined)}><X/></button></header><div className="grid gap-3 sm:grid-cols-3"><input value={editing.icon ?? ''} maxLength={8} placeholder="Icono" onChange={(e) => setEditing({ ...editing, icon: e.target.value })}/><input className="sm:col-span-2" value={editing.name ?? ''} placeholder="Nombre: Fruta y Verdura" onChange={(e) => setEditing({ ...editing, name: e.target.value })}/><select value={editing.buttonSize ?? 'MEDIUM'} onChange={(e) => setEditing({ ...editing, buttonSize: e.target.value })}><option value="SMALL">Pequeño</option><option value="MEDIUM">Mediano</option><option value="LARGE">Grande</option></select><label className="check-field sm:col-span-2"><input type="checkbox" checked={editing.active ?? true} onChange={(e) => setEditing({ ...editing, active: e.target.checked })}/>Grupo activo</label></div><div className="flex gap-2"><input className="flex-1" value={productSearch} placeholder="Buscar productos para agregar" onChange={(e) => setProductSearch(e.target.value)}/><button className="btn-secondary" onClick={() => void searchProducts()}>Buscar</button></div><div className="grid max-h-44 gap-2 overflow-y-auto sm:grid-cols-2">{productOptions.map((product) => <button className="justify-start border" key={product.id} disabled={editing.productIds.includes(product.id)} onClick={() => setEditing({ ...editing, productIds: [...editing.productIds, product.id] })}><Plus size={15}/>{product.name}</button>)}</div><div className="space-y-2">{editing.productIds.map((id, index) => { const known = productOptions.find((p) => p.id === id) ?? groups.flatMap((g) => g.items.map((item) => item.product)).find((p) => p.id === id); const move = (direction: -1 | 1) => { const productIds = [...editing.productIds]; const next = index + direction; if (next < 0 || next >= productIds.length) return; [productIds[index], productIds[next]] = [productIds[next], productIds[index]]; setEditing({ ...editing, productIds }); }; return <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2" key={id}><b className="flex-1">{index + 1}. {known?.name ?? id}</b><button disabled={index === 0} onClick={() => move(-1)}><ChevronUp/></button><button disabled={index === editing.productIds.length - 1} onClick={() => move(1)}><ChevronDown/></button><button onClick={() => setEditing({ ...editing, productIds: editing.productIds.filter((productId) => productId !== id) })}><X/></button></div>; })}</div><footer className="flex justify-end gap-2"><button className="btn-secondary" onClick={() => setEditing(undefined)}>Cancelar</button><button className="btn" onClick={() => void saveGroup()}>Guardar grupo</button></footer></section></div>}
  </div>;
}
function Field({ label, value, set }: { label: string; value: string; set: (value: string) => void }) { return <label>{label}<input value={value} onChange={(e) => set(e.target.value)}/></label>; }
function NumberField({ label, value, set }: { label: string; value: number; set: (value: number) => void }) { return <label>{label}<input type="number" value={value} onChange={(e) => set(Number(e.target.value))}/></label>; }
function Range({ label, min, max, value, set }: { label: string; min: number; max: number; value: number; set: (value: number) => void }) { return <label>{label}<input type="range" min={min} max={max} value={value} onChange={(e) => set(Number(e.target.value))}/></label>; }
