import { useEffect, useState } from 'react';
import { branchContext } from '../lib/branch-context';
import { DEFAULT_POS_SETTINGS, loadPosSettings, savePosSettings, type PosSettings } from '../lib/pos-settings';
export function PosSettingsPage() {
  const branchId = branchContext.get();
  const [settings, setSettings] = useState<PosSettings>(DEFAULT_POS_SETTINGS),
    [saved, setSaved] = useState(false);
  useEffect(() => setSettings(loadPosSettings(branchId)), [branchId]);
  if (!branchId) return <div className="card p-6">Seleccioná una sucursal para configurar su POS.</div>;
  const toggle = (key: keyof PosSettings) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setSettings({ ...settings, [key]: event.target.checked });
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Configuración POS</h1>
        <p className="text-slate-500">Preferencias de operación para esta sucursal y dispositivo.</p>
      </header>
      <section className="card grid gap-5 p-6 md:grid-cols-2">
        <label>
          Modo
          <select
            value={settings.mode}
            onChange={(e) => setSettings({ ...settings, mode: e.target.value as PosSettings['mode'] })}
          >
            <option value="compact">Compacto · teclado/lector</option>
            <option value="touch">Táctil · botones grandes</option>
          </select>
        </label>
        <label>
          Columnas de accesos rápidos
          <input
            type="number"
            min="2"
            max="8"
            value={settings.favoriteColumns}
            onChange={(e) => setSettings({ ...settings, favoriteColumns: Number(e.target.value) })}
          />
        </label>
        {(
          [
            ['showStock', 'Mostrar stock'],
            ['showBarcode', 'Mostrar barcode'],
            ['showClock', 'Mostrar reloj'],
            ['confirmCancel', 'Confirmar antes de cancelar'],
          ] as [keyof PosSettings, string][]
        ).map(([key, label]) => (
          <label className="flex gap-3" key={key}>
            <input type="checkbox" checked={Boolean(settings[key])} onChange={toggle(key)} />
            {label}
          </label>
        ))}
      </section>
      <button
        className="btn-primary"
        onClick={() => {
          savePosSettings(branchId, settings);
          setSaved(true);
        }}
      >
        Guardar configuración
      </button>
      {saved && <span className="badge ml-3">Configuración guardada</span>}
      <p className="text-sm text-amber-700">
        La configuración visual se guarda en este dispositivo. La sincronización entre cajas queda pendiente para
        configuración centralizada.
      </p>
    </div>
  );
}
