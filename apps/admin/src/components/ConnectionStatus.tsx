import { useEffect, useRef, useState } from 'react';
import { Cloud, CloudOff } from 'lucide-react';
import { connectivityService, type ConnectivityState } from '../services/connectivity.service';

export function ConnectionStatus() {
  const [state, setState] = useState<ConnectivityState>(connectivityService.current);
  const [recovered, setRecovered] = useState(false);
  const previous = useRef(state);

  useEffect(
    () =>
      connectivityService.subscribe((next) => {
        if (previous.current !== 'ONLINE' && next === 'ONLINE') {
          setRecovered(true);
          window.setTimeout(() => setRecovered(false), 4000);
        }
        previous.current = next;
        setState(next);
      }),
    [],
  );

  if (state === 'ONLINE' && !recovered)
    return <span className="badge gap-2 text-emerald-700"><Cloud size={15} /> Online</span>;
  if (recovered)
    return <span className="badge gap-2 bg-emerald-50 text-emerald-700"><Cloud size={15} /> Conexión restablecida</span>;
  return (
    <span className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
      <CloudOff className="mr-2 inline" size={16} />
      Sin conexión al servidor. Algunas funciones no están disponibles.
    </span>
  );
}
