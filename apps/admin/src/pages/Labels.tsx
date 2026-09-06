import { useEffect, useState } from 'react';
import { Check, Printer, Search } from 'lucide-react';
import { api } from '../lib/api';
import { branchContext } from '../lib/branch-context';

type Product = {
  id: string;
  internalCode: string;
  name: string;
  taxRate?: string;
  unitType?: string;
  isWeighted?: boolean;
  netContent?: string;
  netContentUnit?: string;
  category?: { name: string };
  barcodes: { barcode: string }[];
  branchConfigs: { branch: { id: string }; salePrice: string }[];
};
type Page = { data: Product[] };
type Pending = {
  id: string;
  oldPrice: string;
  newPrice: string;
  quantity: number;
  createdAt: string;
  product: Omit<Product, 'branchConfigs'>;
  user: { firstName: string; lastName: string };
  branch: { name: string };
};
type Template = 'FLEJE' | 'CARTEL_FYV' | 'A5_LIQUI';
type Printable = { key: string; product: Omit<Product, 'branchConfigs'>; price: number; oldPrice?: number };

const money = (value: number, decimals = 0) =>
  value.toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
function unitPrice(product: Printable['product'], price: number) {
  const content = Number(product.netContent ?? 0),
    unit = product.netContentUnit;
  if (product.isWeighted || product.unitType === 'KG') return `${money(price, 2)} $ / KG`;
  if (content > 0 && unit === 'GRAM') return `${money(price / (content / 1000), 2)} $ / KG`;
  if (content > 0 && unit === 'KG') return `${money(price / content, 2)} $ / KG`;
  if (content > 0 && unit === 'MILLILITER') return `${money(price / (content / 1000), 2)} $ / LT`;
  if (content > 0 && unit === 'LITER') return `${money(price / content, 2)} $ / LT`;
  return `${money(price, 2)} $ / UN`;
}

export function Labels() {
  const branchId = branchContext.get(),
    [tab, setTab] = useState<'catalog' | 'pending'>('pending');
  const [products, setProducts] = useState<Product[]>([]),
    [pending, setPending] = useState<Pending[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [search, setSearch] = useState(''),
    [template, setTemplate] = useState<Template>('FLEJE');
  const load = () =>
    api<Page>(`/products?branchId=${branchId}&enabled=true&search=${encodeURIComponent(search)}&limit=50`).then((x) =>
      setProducts(x.data),
    );
  const loadPending = () => api<Pending[]>(`/labels/pending?branchId=${branchId}`).then(setPending);
  useEffect(() => {
    if (branchId) void Promise.all([load(), loadPending()]);
  }, [branchId]);
  const chosen: Printable[] = (tab === 'pending' ? pending : products)
    .filter((item) => selected.includes(item.id))
    .flatMap((item) => {
      const queued = 'product' in item,
        product = queued ? item.product : item;
      const price = queued
        ? Number(item.newPrice)
        : Number(item.branchConfigs.find((x) => x.branch.id === branchId)?.salePrice ?? 0);
      return Array.from({ length: queued ? item.quantity : 1 }, (_, index) => ({
        key: `${item.id}-${index}`,
        product,
        price,
        oldPrice: queued ? Number(item.oldPrice) : undefined,
      }));
    });
  async function print() {
    if (!branchId || !chosen.length) return;
    if (tab === 'catalog')
      await api('/labels/generated', {
        method: 'POST',
        body: JSON.stringify({ branchId, productIds: selected, template }),
      });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    window.print();
  }
  async function markPrinted() {
    await api('/labels/pending/printed', { method: 'POST', body: JSON.stringify({ ids: selected }) });
    setSelected([]);
    await loadPending();
  }
  const toggle = (id: string, checked: boolean) =>
    setSelected(checked ? [...selected, id] : selected.filter((x) => x !== id));
  return (
    <>
      <div className="no-print">
        <h1 className="text-3xl font-bold">Etiquetas y carteles</h1>
        <p className="mt-2 text-slate-500">
          Elegí el formato según el uso y comprobá la vista previa A4 antes de imprimir.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            className={tab === 'pending' ? 'btn' : 'btn-secondary'}
            onClick={() => {
              setTab('pending');
              setSelected([]);
            }}
          >
            Cambios pendientes <span className="badge">{pending.length}</span>
          </button>
          <button
            className={tab === 'catalog' ? 'btn' : 'btn-secondary'}
            onClick={() => {
              setTab('catalog');
              setSelected([]);
            }}
          >
            Buscar productos
          </button>
        </div>
        <div className="card mt-4 grid gap-3 p-4 md:grid-cols-[1fr_260px_auto_auto]">
          {tab === 'catalog' ? (
            <label className="flex gap-2">
              <Search className="self-center" />
              <input
                className="flex-1"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar producto"
              />
              <button className="btn-secondary" onClick={() => void load()}>
                Buscar
              </button>
            </label>
          ) : (
            <p className="self-center text-sm text-slate-500">{pending.length} cambios esperan impresión</p>
          )}
          <select value={template} onChange={(e) => setTemplate(e.target.value as Template)}>
            <option value="FLEJE">Fleje · precios normales (14 por A4)</option>
            <option value="CARTEL_FYV">Cartel FyV · frutas y verduras (9 por A4)</option>
            <option value="A5_LIQUI">A5 Liqui · liquidación/oferta (1 por A5)</option>
          </select>
          <button className="btn" disabled={!selected.length} onClick={() => void print()}>
            <Printer size={18} />
            Vista previa / imprimir {chosen.length}
          </button>
          {tab === 'pending' && (
            <button className="btn-secondary" disabled={!selected.length} onClick={() => void markPrinted()}>
              <Check size={18} />
              Marcar impresas
            </button>
          )}
        </div>
        <div className="card mt-4 divide-y">
          {tab === 'pending'
            ? pending.map((row) => (
                <label className="flex min-h-16 items-center gap-3 p-4" key={row.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(row.id)}
                    onChange={(e) => toggle(row.id, e.target.checked)}
                  />
                  <div className="min-w-0 flex-1">
                    <b className="block truncate">{row.product.name}</b>
                    <small className="text-slate-500">
                      {row.branch.name} · {row.user.firstName} {row.user.lastName} ·{' '}
                      {new Date(row.createdAt).toLocaleString('es-AR')}
                    </small>
                  </div>
                  <span className="text-sm text-slate-400 line-through">$ {money(Number(row.oldPrice))}</span>
                  <strong>$ {money(Number(row.newPrice))}</strong>
                </label>
              ))
            : products.map((product) => (
                <label className="flex min-h-14 items-center gap-3 p-4" key={product.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(product.id)}
                    disabled={!selected.includes(product.id) && selected.length >= 50}
                    onChange={(e) => toggle(product.id, e.target.checked)}
                  />
                  <span className="font-mono text-sm">{product.internalCode}</span>
                  <b className="flex-1">{product.name}</b>
                  <span>
                    $ {money(Number(product.branchConfigs.find((x) => x.branch.id === branchId)?.salePrice ?? 0))}
                  </span>
                </label>
              ))}
        </div>
      </div>
      <section className={`print-sheet print-template-${template.toLowerCase()}`}>
        {chosen.map((item) => (
          <Label item={item} template={template} key={item.key} />
        ))}
      </section>
    </>
  );
}

function Label({ item, template }: { item: Printable; template: Template }) {
  const { product, price, oldPrice } = item,
    barcode = product.barcodes[0]?.barcode ?? '',
    taxFree = price / (1 + Number(product.taxRate ?? 21) / 100);
  if (template === 'CARTEL_FYV')
    return (
      <article className="label-fyv">
        <p className="label-fold">
          DOBLAR Y ENGANCHAR EN
          <br />
          EL FLEJE PORTAPRECIO
        </p>
        <div className="label-cut" />
        <p className="label-fresh">
          PRODUCTOS FRESCOS
          <br />
          TODOS LOS DÍAS
        </p>
        <h2>{product.name}</h2>
        <div className="label-main-price">
          <small>$</small>
          {money(price)}
        </div>
        <p className="label-tax">PRECIO SIN IMPUESTOS NACIONALES ${money(taxFree, 2)}</p>
        <footer>
          <span>cod.{product.internalCode}</span>
          <span>{unitPrice(product, price)}</span>
        </footer>
      </article>
    );
  if (template === 'A5_LIQUI')
    return (
      <article className="label-liqui">
        <p className="label-fold">
          DOBLAR Y ENGANCHAR EN
          <br />
          EL FLEJE PORTAPRECIO
        </p>
        <h3>LIQUIDACIÓN</h3>
        <p className="label-waste">Cada día cuenta contra el desperdicio alimentario</p>
        <div className="label-main-price">
          <small>$</small>
          {money(price)}
        </div>
        <h2>{product.name}</h2>
        <div className="label-liqui-footer">
          {oldPrice !== undefined && oldPrice !== price && (
            <span>
              ANTES <s>$ {money(oldPrice)}</s>
            </span>
          )}
          <b>{unitPrice(product, price)}</b>
        </div>
        <p className="label-tax">PRECIO SIN IMPUESTOS NACIONALES ${money(taxFree, 2)}</p>
        <small>cod.{product.internalCode}</small>
      </article>
    );
  return (
    <article className="label-fleje">
      <h2>{product.name}</h2>
      <div className="label-fleje-body">
        <div className="label-meta">
          <small>Cod.{product.internalCode}</small>
          <small>{new Date().toLocaleDateString('es-AR')}</small>
          <small>{product.category?.name ?? 'SURTIDO'}</small>
        </div>
        <div>
          <div className="label-main-price">
            <small>$</small>
            {money(price)}
          </div>
          <p>{unitPrice(product, price)}</p>
          <b className="label-tax">PRECIO SIN IMPUESTOS NACIONALES ${money(taxFree, 2)}</b>
        </div>
        <div className="label-barcode">
          <i />
          <small>{barcode}</small>
        </div>
      </div>
    </article>
  );
}
