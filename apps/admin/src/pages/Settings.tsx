import { useEffect, useState } from 'react';
import { Save, Upload, X } from 'lucide-react';
import { branchContext } from '../lib/branch-context';
import { loadPosSettings, savePosSettings, type PosSettings } from '../lib/pos-settings';
const tabs = [
  'GENERAL',
  'APARIENCIA',
  'PRODUCTOS',
  'PRECIOS',
  'STOCK',
  'POS',
  'TICKETS',
  'ETIQUETAS',
  'COMPRAS',
  'SEGURIDAD',
] as const;
type Preferences = {
  systemName: string;
  primaryColor: string;
  secondaryColor: string;
  background?: string;
  backgroundOpacity: number;
  backgroundBlur: number;
  defaultTax: number;
  defaultMargin: number;
  defaultMinimum: number;
  rounding: number;
  targetCoverageDays: number;
};
const defaults: Preferences = {
  systemName: 'El Rincón de los Nietos',
  primaryColor: '#2563eb',
  secondaryColor: '#1e40af',
  backgroundOpacity: 20,
  backgroundBlur: 0,
  defaultTax: 21,
  defaultMargin: 30,
  defaultMinimum: 5,
  rounding: 10,
  targetCoverageDays: 7,
};
export function Settings() {
  const [tab, setTab] = useState<(typeof tabs)[number]>('GENERAL'),
    [prefs, setPrefs] = useState(defaults),
    [saved, setSaved] = useState(false);
  const branchId = branchContext.get(),
    [pos, setPos] = useState<PosSettings>(loadPosSettings(branchId));
  useEffect(() => {
    try {
      setPrefs({ ...defaults, ...JSON.parse(localStorage.getItem('system-preferences') ?? '{}') });
    } catch {
      /* defaults */
    }
  }, []);
  const save = () => {
    localStorage.setItem('system-preferences', JSON.stringify(prefs));
    if (branchId) savePosSettings(branchId, pos);
    document.documentElement.style.setProperty('--brand-primary', prefs.primaryColor);
    setSaved(true);
  };
  const image = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPrefs({ ...prefs, background: String(reader.result) });
    reader.readAsDataURL(file);
  };
  return (
    <div className="space-y-5">
      <header className="page-heading">
        <div>
          <p className="eyebrow">ADMINISTRACIÓN</p>
          <h1>Configuración</h1>
          <p>Comportamiento y apariencia en una única sección.</p>
        </div>
        <button className="btn-primary" onClick={save}>
          <Save size={17} />
          Guardar cambios
        </button>
      </header>
      {saved && <p className="rounded-xl bg-emerald-50 p-3 text-emerald-700">Configuración guardada.</p>}
      <nav className="flex gap-1 overflow-x-auto border-b">
        {tabs.map((x) => (
          <button className={`product-subtab ${tab === x ? 'active' : ''}`} key={x} onClick={() => setTab(x)}>
            {x}
          </button>
        ))}
      </nav>
      <section className="card grid gap-5 p-6 md:grid-cols-2">
        {tab === 'GENERAL' && (
          <>
            <Field
              label="Nombre del sistema"
              value={prefs.systemName}
              set={(systemName) => setPrefs({ ...prefs, systemName })}
            />
            <p className="text-sm text-slate-500">
              Empresa, sucursales y datos fiscales permanecen protegidos en sus fichas.
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
            <label>
              Color secundario
              <input
                type="color"
                value={prefs.secondaryColor}
                onChange={(e) => setPrefs({ ...prefs, secondaryColor: e.target.value })}
              />
            </label>
            <label className="rounded-xl border border-dashed p-4">
              <Upload size={18} /> Fondo del POS
              <input className="mt-2" type="file" accept="image/*" onChange={(e) => image(e.target.files?.[0])} />
            </label>
            {prefs.background && (
              <div
                className="relative h-32 rounded-xl bg-cover"
                style={{ backgroundImage: `url(${prefs.background})` }}
              >
                <button
                  className="absolute right-2 top-2 rounded bg-white p-1"
                  onClick={() => setPrefs({ ...prefs, background: undefined })}
                >
                  <X />
                </button>
              </div>
            )}
            <label>
              Oscurecimiento {prefs.backgroundOpacity}%
              <input
                type="range"
                min="0"
                max="80"
                value={prefs.backgroundOpacity}
                onChange={(e) => setPrefs({ ...prefs, backgroundOpacity: Number(e.target.value) })}
              />
            </label>
            <label>
              Blur {prefs.backgroundBlur}px
              <input
                type="range"
                min="0"
                max="12"
                value={prefs.backgroundBlur}
                onChange={(e) => setPrefs({ ...prefs, backgroundBlur: Number(e.target.value) })}
              />
            </label>
          </>
        )}
        {tab === 'PRODUCTOS' && (
          <>
            <NumberField
              label="IVA predeterminado"
              value={prefs.defaultTax}
              set={(defaultTax) => setPrefs({ ...prefs, defaultTax })}
            />
            <NumberField
              label="Stock mínimo predeterminado"
              value={prefs.defaultMinimum}
              set={(defaultMinimum) => setPrefs({ ...prefs, defaultMinimum })}
            />
          </>
        )}
        {tab === 'PRECIOS' && (
          <>
            <NumberField
              label="Margen predeterminado %"
              value={prefs.defaultMargin}
              set={(defaultMargin) => setPrefs({ ...prefs, defaultMargin })}
            />
            <NumberField label="Redondeo" value={prefs.rounding} set={(rounding) => setPrefs({ ...prefs, rounding })} />
          </>
        )}
        {tab === 'STOCK' && (
          <p>Las políticas de stock negativo y alertas se configuran por sucursal para no mezclar operaciones.</p>
        )}
        {tab === 'POS' && (
          <>
            <label>
              Modo
              <select
                value={pos.mode}
                onChange={(e) => setPos({ ...pos, mode: e.target.value as PosSettings['mode'] })}
              >
                <option value="compact">Compacto</option>
                <option value="touch">Táctil</option>
              </select>
            </label>
            <NumberField
              label="Columnas de favoritos"
              value={pos.favoriteColumns}
              set={(favoriteColumns) => setPos({ ...pos, favoriteColumns })}
            />
          </>
        )}
        {tab === 'COMPRAS' && (
          <NumberField
            label="Días objetivo de cobertura"
            value={prefs.targetCoverageDays}
            set={(targetCoverageDays) => setPrefs({ ...prefs, targetCoverageDays })}
          />
        )}{' '}
        {['TICKETS', 'ETIQUETAS', 'SEGURIDAD'].includes(tab) && (
          <p className="text-slate-500">
            La configuración existente se conserva. Esta vista se irá conectando a parámetros centrales sin borrar datos
            históricos.
          </p>
        )}
      </section>
    </div>
  );
}
function Field({ label, value, set }: { label: string; value: string; set: (x: string) => void }) {
  return (
    <label>
      {label}
      <input value={value} onChange={(e) => set(e.target.value)} />
    </label>
  );
}
function NumberField({ label, value, set }: { label: string; value: number; set: (x: number) => void }) {
  return (
    <label>
      {label}
      <input type="number" value={value} onChange={(e) => set(Number(e.target.value))} />
    </label>
  );
}
