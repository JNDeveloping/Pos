import { useEffect, useState } from 'react';
import { FileSearch, Upload } from 'lucide-react';
import { api } from '../lib/api';
import { branchContext } from '../lib/branch-context';
import { appPath } from '../lib/navigation';
type Doc = {
  id: string;
  originalName: string;
  status: string;
  createdAt: string;
  supplier?: { name: string };
  _count: { items: number };
  purchaseId?: string;
  errorMessage?: string;
};
type AnalysisItem = {
  lineNumber: number;
  rawDescription: string;
  matchedProductId?: string;
  status: string;
  confidence?: string;
  totalUnits?: string;
  unitCost?: string;
};
type DocumentDetail = Doc & { items: AnalysisItem[] };
export function InvoiceImport() {
  const [docs, setDocs] = useState<Doc[]>([]),
    [file, setFile] = useState<File>(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [selected, setSelected] = useState<DocumentDetail>();
  const load = () =>
    api<Doc[]>('/invoices')
      .then(setDocs)
      .catch((e) => setMessage(String(e)));
  useEffect(() => {
    void load();
  }, []);
  async function upload() {
    if (!file) return;
    setBusy(true);
    setMessage('');
    try {
      const body = new FormData();
      body.append('file', file);
      const doc = await api<Doc>('/invoices/upload', { method: 'POST', body });
      await api(`/invoice-analysis/${doc.id}/analyze`, { method: 'POST', body: JSON.stringify({}) });
      setMessage('Archivo conservado y enviado a revisión. La confirmación humana sigue siendo obligatoria.');
      await load();
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Importar factura</h1>
        <p className="text-slate-500">PDF o imagen → análisis estructurado → matching → revisión → compra.</p>
        <p className="mt-2 text-sm text-amber-700">
          Sin un proveedor de IA/OCR configurado, el archivo se conserva y queda disponible para carga manual.
        </p>
      </header>
      <section className="card grid gap-5 p-6 lg:grid-cols-2">
        <div className="grid min-h-64 place-items-center rounded-2xl border-2 border-dashed p-6 text-center">
          <div>
            <Upload className="mx-auto mb-3" />
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={(e) => setFile(e.target.files?.[0])}
            />
            <p className="mt-3 text-sm text-slate-500">Se valida MIME real, tamaño y firma del archivo.</p>
          </div>
        </div>
        <div>
          <h2 className="font-bold">Revisión humana obligatoria</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600">
            <li>Detectar proveedor y comprobante.</li>
            <li>Resolver códigos, barcodes y alias aprendidos.</li>
            <li>Revisar cantidades, bultos, costos y totales.</li>
            <li>Confirmar explícitamente la compra y los costos.</li>
          </ol>
          <button className="btn-primary mt-5" disabled={!file || busy} onClick={() => void upload()}>
            {busy ? 'Procesando…' : 'Subir y analizar'}
          </button>
          {message && <p className="mt-3 rounded-lg bg-slate-100 p-3 text-sm">{message}</p>}
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-bold">Facturas procesadas</h2>
        <div className="grid gap-3">
          {docs.map((x) => (
            <div className="card flex flex-wrap items-center gap-4 p-4" key={x.id}>
              <FileSearch />
              <span className="min-w-0 flex-1">
                <b className="block truncate">{x.originalName}</b>
                <small>
                  {x.supplier?.name || 'Proveedor por identificar'} · {x._count.items} líneas
                </small>
              </span>
              <span className="badge">{x.status}</span>
              <button
                className="btn-secondary"
                onClick={() =>
                  void api<DocumentDetail>(`/invoice-documents/${x.id}`)
                    .then(setSelected)
                    .catch((e) => setMessage(String(e)))
                }
              >
                Revisar
              </button>
              {x.errorMessage && <small className="w-full text-red-600">{x.errorMessage}</small>}
              {x.purchaseId ? (
                <a className="btn-secondary" href={appPath(`/admin/purchases/${x.purchaseId}`)}>
                  Ver compra
                </a>
              ) : x.status === 'REVIEW' ? (
                <button
                  className="btn-primary"
                  onClick={async () => {
                    const branchId = branchContext.get();
                    if (!branchId) return setMessage('Seleccione una sucursal antes de confirmar la factura.');
                    try {
                      const purchase = await api<{ id: string }>(`/invoice-analysis/${x.id}/confirm`, {
                        method: 'POST',
                        body: JSON.stringify({ branchId }),
                      });
                      window.location.href = appPath(`/admin/purchases/${purchase.id}`);
                    } catch (error) {
                      setMessage(error instanceof Error ? error.message : 'No se pudo confirmar la factura');
                    }
                  }}
                >
                  Convertir en compra
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </section>
      {selected && (
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b p-4">
            <div>
              <h2 className="font-bold">Revisión de {selected.originalName}</h2>
              <p className="text-sm text-slate-500">Cada línea debe quedar vinculada antes de convertirla en compra.</p>
            </div>
            <button className="btn-secondary" onClick={() => setSelected(undefined)}>
              Cerrar
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Línea original</th>
                  <th>Cantidad</th>
                  <th>Costo</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {selected.items.map((item) => (
                  <tr key={item.lineNumber}>
                    <td>{item.rawDescription}</td>
                    <td>{item.totalUnits ?? '—'}</td>
                    <td>{item.unitCost ?? '—'}</td>
                    <td>
                      <span className="badge">{item.status}</span>
                    </td>
                    <td>
                      <button
                        className="btn-secondary"
                        onClick={async () => {
                          const search = prompt('Buscar producto por nombre, código o barcode', item.rawDescription);
                          if (!search) return;
                          const page = await api<{ data: { id: string; name: string }[] }>(
                            `/products?search=${encodeURIComponent(search)}&limit=10`,
                          );
                          const product = page.data[0];
                          if (!product) return setMessage('No se encontró un producto para vincular.');
                          if (!confirm(`¿Vincular con ${product.name}?`)) return;
                          await api(`/invoice-analysis/${selected.id}/items/${item.lineNumber}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ productId: product.id, learnAlias: true }),
                          });
                          setSelected(await api<DocumentDetail>(`/invoice-documents/${selected.id}`));
                        }}
                      >
                        Buscar y vincular
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
