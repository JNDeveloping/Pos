import { useEffect, useState } from 'react';
import { FileSearch, Upload } from 'lucide-react';
import { api } from '../lib/api';
type Doc = {
  id: string;
  originalName: string;
  status: string;
  createdAt: string;
  supplier?: { name: string };
  _count: { items: number };
};
export function InvoiceImport() {
  const [docs, setDocs] = useState<Doc[]>([]),
    [file, setFile] = useState<File>(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const load = () =>
    api<Doc[]>('/invoice-documents')
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
      const doc = await api<Doc>('/invoice-documents/upload', { method: 'POST', body });
      await api(`/invoice-documents/${doc.id}/analyze`, { method: 'POST', body: JSON.stringify({}) });
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
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
