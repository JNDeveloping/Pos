import { Maximize2, Minimize2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export function FullscreenButton({ className = 'icon-button' }: { className?: string }) {
  const [active, setActive] = useState(Boolean(document.fullscreenElement));
  useEffect(() => {
    const update = () => setActive(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);
  return <button type="button" className={className} title={active ? 'Salir de pantalla completa' : 'Usar pantalla completa'} aria-label={active ? 'Salir de pantalla completa' : 'Usar pantalla completa'} onClick={() => void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())}>{active ? <Minimize2/> : <Maximize2/>}</button>;
}
