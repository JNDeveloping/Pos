import { Download, RefreshCw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
export function PwaManager() {
  const [install, setInstall] = useState<InstallEvent>();
  const [update, setUpdate] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [applyUpdate, setApplyUpdate] = useState<() => Promise<void>>();
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    const updater = registerSW({
      immediate: true,
      onNeedRefresh() {
        setUpdate(true);
      },
      onOfflineReady() {
        setOfflineReady(true);
      },
    });
    setApplyUpdate(() => () => updater(true));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  if (!install && !update && !offlineReady) return null;
  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-900 p-4 text-sm text-white shadow-2xl sm:left-auto sm:max-w-md">
      {update ? (
        <>
          <span>Hay una nueva versión disponible.</span>
          <button className="btn bg-white text-brand-700" onClick={() => void applyUpdate?.()}>
            <RefreshCw size={16} />
            Actualizar
          </button>
        </>
      ) : install ? (
        <>
          <span>Instalá la aplicación en este dispositivo.</span>
          <button
            className="btn bg-white text-brand-700"
            onClick={async () => {
              await install.prompt();
              await install.userChoice;
              setInstall(undefined);
            }}
          >
            <Download size={16} />
            Instalar aplicación
          </button>
        </>
      ) : (
        <>
          <span>Dispositivo preparado para trabajar sin conexión.</span>
          <button aria-label="Cerrar" onClick={() => setOfflineReady(false)}>
            <X />
          </button>
        </>
      )}
    </div>
  );
}
