import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, ImagePlus, Plus, Save, Trash2, X } from 'lucide-react';
import { branchContext } from '../lib/branch-context';
import { api } from '../lib/api';
import { API } from '../lib/api';
import { DEFAULT_POS_SETTINGS, type PosSettings } from '../lib/pos-settings';

const tabs = ['GENERAL', 'APARIENCIA', 'POS', 'PRECIOS', 'STOCK', 'TICKETS'] as const;
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
type Terminal = {
  id: string;
  branchId: string;
  code: string;
  name: string;
  active: boolean;
  printerName?: string;
  cashSessions?: { id: string; cashier: { firstName: string; lastName: string } }[];
};
type PaymentKind = 'CASH' | 'DEBIT' | 'CREDIT' | 'TRANSFER' | 'QR' | 'ACCOUNT' | 'OTHER';
type PaymentMethod = {
  id: string;
  code: string;
  name: string;
  kind: PaymentKind;
  active: boolean;
  requiresReference: boolean;
};
type PricingRules = {
  targetMargin: string;
  roundingMode: string;
  roundingCustom?: string;
  roundingDirection: 'UP' | 'NEAREST';
  psychologicalEnding: string;
  priceUpdateMode: 'AUTO' | 'SUGGEST' | 'KEEP';
};
const defaults: Appearance = {
  systemName: 'El Rincón de los Nietos',
  primaryColor: '#16a34a',
  backgroundOpacity: 28,
  backgroundOverlay: '#020617',
  backgroundBlur: 0,
  backgroundPosition: 'center',
  defaultTax: 21,
  defaultMargin: 30,
  defaultMinimum: 5,
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
  const [terminals, setTerminals] = useState<Terminal[]>([]),
    [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [editingTerminal, setEditingTerminal] = useState<Terminal>();
  const [pricing, setPricing] = useState<PricingRules>({
    targetMargin: '30',
    roundingMode: 'MULTIPLE_10',
    roundingDirection: 'UP',
    psychologicalEnding: 'NONE',
    priceUpdateMode: 'SUGGEST',
  });

  const loadGroups = async () => {
    if (!branchId) return;
    setGroups(await api(`/pos-quick-groups?branchId=${branchId}`));
  };
  useEffect(() => {
    void api<{ appearance?: Partial<Appearance>; pos?: PosSettings }>(
      `/settings${branchId ? `?branchId=${branchId}` : ''}`,
    ).then((data) => {
      setPrefs({ ...defaults, ...data.appearance });
      setPos({ ...DEFAULT_POS_SETTINGS, ...data.pos });
    });
    void loadGroups();
    void api<PricingRules>('/pricing/rules').then((rules) =>
      setPricing({
        ...rules,
        targetMargin: String(rules.targetMargin),
        roundingCustom: rules.roundingCustom ? String(rules.roundingCustom) : undefined,
      }),
    );
    if (branchId) {
      void api<Terminal[]>('/terminals').then((rows) => setTerminals(rows.filter((row) => row.branchId === branchId)));
      void api<PaymentMethod[]>('/payment-methods').then(setPaymentMethods);
    }
  }, [branchId]);

  const createTerminal = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!branchId) return;
    const form = new FormData(event.currentTarget);
    const terminal = await api<Terminal>('/terminals', {
      method: 'POST',
      body: JSON.stringify({
        branchId,
        name: form.get('name'),
        code: form.get('code'),
        printerName: form.get('printerName') || undefined,
        active: true,
      }),
    });
    setTerminals([...terminals, terminal]);
    event.currentTarget.reset();
    setMessage('Terminal creada y disponible para abrir caja.');
  };
  const updatePayment = async (method: PaymentMethod, active: boolean) => {
    await api(`/payment-methods/${method.id}`, { method: 'PATCH', body: JSON.stringify({ ...method, active }) });
    setPaymentMethods(paymentMethods.map((item) => (item.id === method.id ? { ...item, active } : item)));
  };
  const updatePaymentKind = async (method: PaymentMethod, kind: PaymentKind) => {
    await api(`/payment-methods/${method.id}`, { method: 'PATCH', body: JSON.stringify({ ...method, kind }) });
    setPaymentMethods(paymentMethods.map((item) => (item.id === method.id ? { ...item, kind } : item)));
  };
  const toggleTerminal = async (terminal: Terminal) => {
    await api(`/terminals/${terminal.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        branchId: terminal.branchId,
        code: terminal.code,
        name: terminal.name,
        printerName: terminal.printerName,
        active: !terminal.active,
      }),
    });
    setTerminals(terminals.map((item) => (item.id === terminal.id ? { ...item, active: !item.active } : item)));
  };
  const saveTerminal = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingTerminal) return;
    const updated = await api(`/terminals/${editingTerminal.id}`, {
      method: 'PATCH',
      body: JSON.stringify(editingTerminal),
    });
    setTerminals(terminals.map((item) => (item.id === editingTerminal.id ? editingTerminal : item)));
    setEditingTerminal(undefined);
    setMessage(updated ? 'Terminal actualizada.' : 'No se pudo actualizar la terminal.');
  };

  const save = async () => {
    await Promise.all([
      api(`/settings${branchId ? `?branchId=${branchId}` : ''}`, {
        method: 'PUT',
        body: JSON.stringify({ appearance: prefs, pos }),
      }),
      api('/pricing/rules', { method: 'PUT', body: JSON.stringify(pricing) }),
    ]);
    setMessage('Configuración guardada en el servidor. Ya está disponible para las demás terminales.');
  };
  const upload = async (file?: File) => {
    if (!file) return;
    const body = new FormData();
    body.append('file', file);
    const result = await api<{ url: string }>('/settings/pos-background', { method: 'POST', body });
    setPrefs((current) => ({ ...current, background: result.url }));
  };
  const searchProducts = async () => {
    if (!branchId || productSearch.trim().length < 2) return;
    const page = await api<{ data: ProductOption[] }>(
      `/products?branchId=${branchId}&enabled=true&limit=12&search=${encodeURIComponent(productSearch)}`,
    );
    setProductOptions(page.data);
  };
  const saveGroup = async () => {
    if (!branchId || !editing?.name?.trim()) return;
    const payload = {
      branchId,
      name: editing.name,
      icon: editing.icon || '◉',
      sortOrder: editing.sortOrder ?? groups.length,
      buttonSize: editing.buttonSize || 'MEDIUM',
      active: editing.active ?? true,
      productIds: editing.productIds,
    };
    await api(editing.id ? `/pos-quick-groups/${editing.id}` : '/pos-quick-groups', {
      method: editing.id ? 'PATCH' : 'POST',
      body: JSON.stringify(payload),
    });
    setEditing(undefined);
    setProductOptions([]);
    setProductSearch('');
    await loadGroups();
  };
  const moveGroup = async (index: number, direction: -1 | 1) => {
    const other = groups[index + direction];
    if (!branchId || !other) return;
    const current = groups[index];
    const update = (group: QuickGroup, sortOrder: number) =>
      api(`/pos-quick-groups/${group.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          branchId,
          name: group.name,
          icon: group.icon,
          sortOrder,
          buttonSize: group.buttonSize,
          active: group.active,
          productIds: group.items.map((item) => item.product.id),
        }),
      });
    await Promise.all([update(current, other.sortOrder), update(other, current.sortOrder)]);
    await loadGroups();
  };

  return (
    <div className="space-y-5">
      <header className="page-heading">
        <div>
          <p className="eyebrow">CENTRO DE CONTROL</p>
          <h1>Configuración</h1>
          <p>Personalizá la operación sin depender de este navegador.</p>
        </div>
        <button className="btn-primary" onClick={() => void save()}>
          <Save size={17} />
          Guardar
        </button>
      </header>
      {message && <p className="rounded-xl bg-emerald-50 p-3 text-emerald-800">{message}</p>}
      <nav className="settings-tabs">
        {tabs.map((item) => (
          <button className={tab === item ? 'active' : ''} key={item} onClick={() => setTab(item)}>
            {item}
          </button>
        ))}
      </nav>
      <section className="card settings-panel">
        {tab === 'GENERAL' && (
          <>
            <Field
              label="Nombre del sistema"
              value={prefs.systemName}
              set={(systemName) => setPrefs({ ...prefs, systemName })}
            />
            <p className="setting-help">
              Los datos fiscales y de sucursal se administran desde la ficha de Sucursales.
            </p>
          </>
        )}
        {tab === 'APARIENCIA' && (
          <>
            <label>
              Color principal
              <input
                type="color"
                value={prefs.primaryColor}
                onChange={(e) => setPrefs({ ...prefs, primaryColor: e.target.value })}
              />
            </label>
            <label className="setting-upload">
              <ImagePlus /> Fondo del POS
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => void upload(e.target.files?.[0])}
              />
            </label>
            {prefs.background && (
              <div
                className="pos-background-preview"
                style={{
                  backgroundImage: `linear-gradient(${prefs.backgroundOverlay}${Math.round(
                    prefs.backgroundOpacity * 2.55,
                  )
                    .toString(16)
                    .padStart(2, '0')}, ${prefs.backgroundOverlay}${Math.round(prefs.backgroundOpacity * 2.55)
                    .toString(16)
                    .padStart(
                      2,
                      '0',
                    )}), url(${prefs.background.startsWith('/api') ? `${API.replace(/\/api$/, '')}${prefs.background}` : prefs.background})`,
                  backgroundPosition: prefs.backgroundPosition,
                }}
              >
                <button onClick={() => setPrefs({ ...prefs, background: undefined })}>
                  <X />
                  Quitar
                </button>
              </div>
            )}
            <Range
              label={`Oscurecimiento ${prefs.backgroundOpacity}%`}
              min={0}
              max={80}
              value={prefs.backgroundOpacity}
              set={(backgroundOpacity) => setPrefs({ ...prefs, backgroundOpacity })}
            />
            <Range
              label={`Desenfoque ${prefs.backgroundBlur}px`}
              min={0}
              max={12}
              value={prefs.backgroundBlur}
              set={(backgroundBlur) => setPrefs({ ...prefs, backgroundBlur })}
            />
            <label>
              Posición
              <select
                value={prefs.backgroundPosition}
                onChange={(e) => setPrefs({ ...prefs, backgroundPosition: e.target.value })}
              >
                <option value="center">Centro</option>
                <option value="top">Arriba</option>
                <option value="bottom">Abajo</option>
                <option value="left">Izquierda</option>
                <option value="right">Derecha</option>
              </select>
            </label>
          </>
        )}
        {tab === 'POS' && (
          <div className="md:col-span-2 space-y-5">
            {!branchId ? (
              <p>Seleccioná una sucursal para configurar el POS.</p>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <label>
                    Modo
                    <select
                      value={pos.mode}
                      onChange={(e) => setPos({ ...pos, mode: e.target.value as PosSettings['mode'] })}
                    >
                      <option value="touch">Táctil</option>
                      <option value="compact">Compacto</option>
                    </select>
                  </label>
                  <NumberField
                    label="Columnas de botones"
                    value={pos.favoriteColumns}
                    set={(favoriteColumns) => setPos({ ...pos, favoriteColumns })}
                  />
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={pos.showStock}
                      onChange={(e) => setPos({ ...pos, showStock: e.target.checked })}
                    />
                    Mostrar stock
                  </label>
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={pos.showBarcode}
                      onChange={(e) => setPos({ ...pos, showBarcode: e.target.checked })}
                    />
                    Mostrar barcode
                  </label>
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={pos.showClock}
                      onChange={(e) => setPos({ ...pos, showClock: e.target.checked })}
                    />
                    Mostrar reloj
                  </label>
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={pos.autoPrintTicket}
                      onChange={(e) => setPos({ ...pos, autoPrintTicket: e.target.checked })}
                    />
                    Abrir impresión del ticket al cobrar
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Grupos táctiles</h2>
                    <p className="text-sm text-slate-500">
                      Un toque abre el grupo; otro agrega el producto o solicita peso.
                    </p>
                  </div>
                  <button
                    className="btn"
                    onClick={() =>
                      setEditing({
                        name: '',
                        icon: '◉',
                        active: true,
                        buttonSize: 'MEDIUM',
                        sortOrder: groups.length,
                        productIds: [],
                      })
                    }
                  >
                    <Plus />
                    Nuevo grupo
                  </button>
                </div>
                <div className="quick-group-editor-list">
                  {groups.map((group, index) => (
                    <article key={group.id}>
                      <span className="text-2xl">{group.icon}</span>
                      <div>
                        <b>{group.name}</b>
                        <small>
                          {group.items.length} productos · botón {group.buttonSize.toLowerCase()}
                        </small>
                      </div>
                      <button disabled={index === 0} title="Subir" onClick={() => void moveGroup(index, -1)}>
                        <ChevronUp />
                      </button>
                      <button
                        disabled={index === groups.length - 1}
                        title="Bajar"
                        onClick={() => void moveGroup(index, 1)}
                      >
                        <ChevronDown />
                      </button>
                      <button
                        onClick={() => setEditing({ ...group, productIds: group.items.map((item) => item.product.id) })}
                      >
                        Editar
                      </button>
                      <button
                        className="text-red-700"
                        onClick={async () => {
                          if (confirm(`¿Eliminar ${group.name}?`)) {
                            await api(`/pos-quick-groups/${group.id}`, { method: 'DELETE' });
                            await loadGroups();
                          }
                        }}
                      >
                        <Trash2 />
                      </button>
                    </article>
                  ))}
                </div>
                <div className="grid gap-5 border-t pt-5 lg:grid-cols-2">
                  <section>
                    <h2 className="text-xl font-bold">Terminales</h2>
                    <div className="mt-3 space-y-2">
                      {terminals.map((terminal) => (
                        <div
                          className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 p-3"
                          key={terminal.id}
                        >
                          <span className="flex-1">
                            <b>{terminal.name}</b>
                            <small className="block">
                              {terminal.code} · {terminal.printerName || 'Sin impresora asociada'}
                            </small>
                            <small className="block">
                              {terminal.cashSessions?.[0]
                                ? `Caja abierta · ${terminal.cashSessions[0].cashier.firstName} ${terminal.cashSessions[0].cashier.lastName}`
                                : 'Caja cerrada'}
                            </small>
                          </span>
                          <button onClick={() => setEditingTerminal(terminal)}>Editar</button>
                          <button
                            className="badge"
                            disabled={Boolean(terminal.cashSessions?.length)}
                            onClick={() => void toggleTerminal(terminal)}
                          >
                            {terminal.active ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      ))}
                    </div>
                    <form className="mt-3 grid gap-2 sm:grid-cols-3" onSubmit={createTerminal}>
                      <input name="name" required placeholder="Nombre: Caja 1" />
                      <input name="code" required placeholder="Código: CAJA-1" />
                      <input name="printerName" placeholder="Impresora opcional" />
                      <button className="btn sm:col-span-3">Crear terminal</button>
                    </form>
                  </section>
                  <section>
                    <h2 className="text-xl font-bold">Medios de pago</h2>
                    <p className="text-sm text-slate-500">
                      La naturaleza determina si el pago impacta efectivo, banco/QR o cuenta corriente.
                    </p>
                    <div className="mt-3 space-y-2">
                      {paymentMethods.map((method) => (
                        <div
                          className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-lg bg-slate-50 p-3"
                          key={method.id}
                        >
                          <span>
                            <b>{method.name}</b>
                            <small className="block">
                              {method.code}
                              {method.requiresReference ? ' · requiere referencia' : ''}
                            </small>
                          </span>
                          <input
                            type="checkbox"
                            checked={method.active}
                            onChange={(event) => void updatePayment(method, event.target.checked)}
                          />
                          <select
                            className="col-span-2"
                            value={method.kind}
                            onChange={(event) => void updatePaymentKind(method, event.target.value as PaymentKind)}
                          >
                            <option value="CASH">Efectivo en caja</option>
                            <option value="DEBIT">Débito</option>
                            <option value="CREDIT">Crédito</option>
                            <option value="TRANSFER">Transferencia</option>
                            <option value="QR">QR / billetera</option>
                            <option value="ACCOUNT">Cuenta corriente</option>
                            <option value="OTHER">Otro</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </>
            )}
          </div>
        )}
        {tab === 'PRECIOS' && (
          <div className="md:col-span-2 space-y-5">
            <div>
              <h2 className="text-xl font-bold">Reglas de costos y precios</h2>
              <p className="text-sm text-slate-500">
                El margen objetivo es porcentaje sobre el precio de venta; no es recargo sobre costo. Por seguridad, el
                cambio de costo inicialmente sólo sugiere.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <label>
                Margen objetivo %
                <input
                  type="number"
                  min="0"
                  max="99.99"
                  step="0.01"
                  value={pricing.targetMargin}
                  onChange={(e) => setPricing({ ...pricing, targetMargin: e.target.value })}
                />
              </label>
              <label>
                Redondeo
                <select
                  value={pricing.roundingMode}
                  onChange={(e) => setPricing({ ...pricing, roundingMode: e.target.value })}
                >
                  <option value="NONE">Sin redondeo</option>
                  <option value="MULTIPLE_10">Próximo $10</option>
                  <option value="MULTIPLE_50">Próximo $50</option>
                  <option value="MULTIPLE_100">Próximo $100</option>
                  <option value="MULTIPLE_500">Próximo $500</option>
                  <option value="MULTIPLE_1000">Próximo $1.000</option>
                  <option value="CUSTOM">Personalizado</option>
                </select>
              </label>
              {pricing.roundingMode === 'CUSTOM' && (
                <label>
                  Múltiplo personalizado
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={pricing.roundingCustom ?? ''}
                    onChange={(e) => setPricing({ ...pricing, roundingCustom: e.target.value })}
                  />
                </label>
              )}
              <label>
                Dirección
                <select
                  value={pricing.roundingDirection}
                  onChange={(e) =>
                    setPricing({ ...pricing, roundingDirection: e.target.value as PricingRules['roundingDirection'] })
                  }
                >
                  <option value="UP">Siempre hacia arriba</option>
                  <option value="NEAREST">Al más cercano</option>
                </select>
              </label>
              <label>
                Terminación comercial
                <select
                  value={pricing.psychologicalEnding}
                  onChange={(e) => setPricing({ ...pricing, psychologicalEnding: e.target.value })}
                >
                  <option value="NONE">Sin terminación</option>
                  <option value="END_90">Termina en 90</option>
                  <option value="END_99">Termina en 99</option>
                  <option value="END_50">Termina en 50</option>
                  <option value="END_00">Termina en 00</option>
                </select>
              </label>
              <label>
                Al cambiar costo
                <select
                  value={pricing.priceUpdateMode}
                  onChange={(e) =>
                    setPricing({ ...pricing, priceUpdateMode: e.target.value as PricingRules['priceUpdateMode'] })
                  }
                >
                  <option value="SUGGEST">Sugerir y confirmar</option>
                  <option value="AUTO">Actualizar automáticamente</option>
                  <option value="KEEP">No modificar precio</option>
                </select>
              </label>
              <NumberField
                label="IVA predeterminado"
                value={prefs.defaultTax}
                set={(defaultTax) => setPrefs({ ...prefs, defaultTax })}
              />
            </div>
          </div>
        )}
        {tab === 'STOCK' && (
          <>
            <NumberField
              label="Stock mínimo predeterminado"
              value={prefs.defaultMinimum}
              set={(defaultMinimum) => setPrefs({ ...prefs, defaultMinimum })}
            />
            <p className="setting-help">
              Los saldos Local/Depósito se guardan por sucursal; la reposición interna se incorporará en la pantalla
              Stock.
            </p>
          </>
        )}
        {tab === 'TICKETS' && (
          <p className="setting-help">
            Encabezado, pie, ancho e información fiscal se configuran desde la ficha de cada sucursal.
          </p>
        )}
      </section>
      {editing && (
        <div className="modal-backdrop">
          <section className="modal-card max-w-2xl">
            <header className="flex justify-between">
              <div>
                <h2 className="text-xl font-bold">{editing.id ? 'Editar grupo' : 'Nuevo grupo táctil'}</h2>
                <p className="text-sm text-slate-500">
                  Elegí y ordená los productos para trabajar con uno o dos toques.
                </p>
              </div>
              <button onClick={() => setEditing(undefined)}>
                <X />
              </button>
            </header>
            <div className="grid gap-3 sm:grid-cols-3">
              <input
                value={editing.icon ?? ''}
                maxLength={8}
                placeholder="Icono"
                onChange={(e) => setEditing({ ...editing, icon: e.target.value })}
              />
              <input
                className="sm:col-span-2"
                value={editing.name ?? ''}
                placeholder="Nombre: Fruta y Verdura"
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
              <select
                value={editing.buttonSize ?? 'MEDIUM'}
                onChange={(e) => setEditing({ ...editing, buttonSize: e.target.value })}
              >
                <option value="SMALL">Pequeño</option>
                <option value="MEDIUM">Mediano</option>
                <option value="LARGE">Grande</option>
              </select>
              <label className="check-field sm:col-span-2">
                <input
                  type="checkbox"
                  checked={editing.active ?? true}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                />
                Grupo activo
              </label>
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1"
                value={productSearch}
                placeholder="Buscar productos para agregar"
                onChange={(e) => setProductSearch(e.target.value)}
              />
              <button className="btn-secondary" onClick={() => void searchProducts()}>
                Buscar
              </button>
            </div>
            <div className="grid max-h-44 gap-2 overflow-y-auto sm:grid-cols-2">
              {productOptions.map((product) => (
                <button
                  className="justify-start border"
                  key={product.id}
                  disabled={editing.productIds.includes(product.id)}
                  onClick={() => setEditing({ ...editing, productIds: [...editing.productIds, product.id] })}
                >
                  <Plus size={15} />
                  {product.name}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {editing.productIds.map((id, index) => {
                const known =
                  productOptions.find((p) => p.id === id) ??
                  groups.flatMap((g) => g.items.map((item) => item.product)).find((p) => p.id === id);
                const move = (direction: -1 | 1) => {
                  const productIds = [...editing.productIds];
                  const next = index + direction;
                  if (next < 0 || next >= productIds.length) return;
                  [productIds[index], productIds[next]] = [productIds[next], productIds[index]];
                  setEditing({ ...editing, productIds });
                };
                return (
                  <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2" key={id}>
                    <b className="flex-1">
                      {index + 1}. {known?.name ?? id}
                    </b>
                    <button disabled={index === 0} onClick={() => move(-1)}>
                      <ChevronUp />
                    </button>
                    <button disabled={index === editing.productIds.length - 1} onClick={() => move(1)}>
                      <ChevronDown />
                    </button>
                    <button
                      onClick={() =>
                        setEditing({
                          ...editing,
                          productIds: editing.productIds.filter((productId) => productId !== id),
                        })
                      }
                    >
                      <X />
                    </button>
                  </div>
                );
              })}
            </div>
            <footer className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setEditing(undefined)}>
                Cancelar
              </button>
              <button className="btn" onClick={() => void saveGroup()}>
                Guardar grupo
              </button>
            </footer>
          </section>
        </div>
      )}
      {editingTerminal && (
        <div className="modal-backdrop">
          <form className="modal-card max-w-xl" onSubmit={saveTerminal}>
            <header className="flex justify-between">
              <div>
                <h2 className="text-xl font-bold">Editar terminal</h2>
                <p className="text-sm text-slate-500">
                  La sucursal asignada se conserva y el código es único dentro de ella.
                </p>
              </div>
              <button type="button" onClick={() => setEditingTerminal(undefined)}>
                <X />
              </button>
            </header>
            <label>
              Nombre
              <input
                required
                value={editingTerminal.name}
                onChange={(event) => setEditingTerminal({ ...editingTerminal, name: event.target.value })}
              />
            </label>
            <label>
              Código
              <input
                required
                value={editingTerminal.code}
                onChange={(event) => setEditingTerminal({ ...editingTerminal, code: event.target.value.toUpperCase() })}
              />
            </label>
            <label>
              Impresora opcional
              <input
                value={editingTerminal.printerName ?? ''}
                onChange={(event) => setEditingTerminal({ ...editingTerminal, printerName: event.target.value })}
              />
            </label>
            <footer className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setEditingTerminal(undefined)}>
                Cancelar
              </button>
              <button className="btn">Guardar terminal</button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
function Field({ label, value, set }: { label: string; value: string; set: (value: string) => void }) {
  return (
    <label>
      {label}
      <input value={value} onChange={(e) => set(e.target.value)} />
    </label>
  );
}
function NumberField({ label, value, set }: { label: string; value: number; set: (value: number) => void }) {
  return (
    <label>
      {label}
      <input type="number" value={value} onChange={(e) => set(Number(e.target.value))} />
    </label>
  );
}
function Range({
  label,
  min,
  max,
  value,
  set,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  set: (value: number) => void;
}) {
  return (
    <label>
      {label}
      <input type="range" min={min} max={max} value={value} onChange={(e) => set(Number(e.target.value))} />
    </label>
  );
}
