export type ConnectivityState = 'ONLINE' | 'OFFLINE' | 'SERVER_UNAVAILABLE';

type Listener = (state: ConnectivityState) => void;

export class ConnectivityService {
  private listeners = new Set<Listener>();
  private timer?: number;
  private running = false;
  private checking?: Promise<ConnectivityState>;
  current: ConnectivityState = navigator.onLine ? 'ONLINE' : 'OFFLINE';

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.current);
    return () => {
      this.listeners.delete(listener);
    };
  }

  start() {
    if (this.running) return;
    this.running = true;
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    void this.check();
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    if (this.timer) window.clearTimeout(this.timer);
  }

  check(): Promise<ConnectivityState> {
    if (this.checking) return this.checking;
    this.checking = this.probe().finally(() => {
      this.checking = undefined;
      this.schedule();
    });
    return this.checking;
  }

  private async probe() {
    if (!navigator.onLine) return this.update('OFFLINE');
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${import.meta.env.BASE_URL}api/health`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      window.clearTimeout(timeout);
      return this.update(response.ok ? 'ONLINE' : 'SERVER_UNAVAILABLE');
    } catch {
      return this.update('SERVER_UNAVAILABLE');
    }
  }

  private schedule() {
    if (!this.running) return;
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.check(), this.current === 'ONLINE' ? 60000 : 20000);
  }

  private update(state: ConnectivityState) {
    if (state !== this.current) {
      this.current = state;
      this.listeners.forEach((listener) => listener(state));
    }
    return state;
  }

  private handleOnline = () => void this.check();
  private handleOffline = () => {
    this.update('OFFLINE');
    this.schedule();
  };
}

export const connectivityService = new ConnectivityService();
