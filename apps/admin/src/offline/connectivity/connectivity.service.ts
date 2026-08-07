import { API } from '../../lib/api';
import type { ConnectionStatus } from '../db/types';
type Listener = (status: ConnectionStatus) => void;
export class ConnectivityService {
  private status: ConnectionStatus = navigator.onLine ? 'SERVER_UNAVAILABLE' : 'OFFLINE';
  private listeners = new Set<Listener>();
  private timer?: number;
  get current() {
    return this.status;
  }
  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.status);
    return () => {
      this.listeners.delete(listener);
    };
  }
  set(status: ConnectionStatus) {
    if (this.status === status) return;
    this.status = status;
    this.listeners.forEach((x) => x(status));
  }
  async probe() {
    if (!navigator.onLine) {
      this.set('OFFLINE');
      return false;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(`${API}/health`, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error();
      this.set('ONLINE');
      return true;
    } catch {
      this.set('SERVER_UNAVAILABLE');
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }
  start() {
    if (this.timer) return;
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    void this.probe();
    this.timer = window.setInterval(() => void this.probe(), 15000);
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }
  private handleOnline = () => void this.probe();
  private handleOffline = () => this.set('OFFLINE');
}
export const connectivityService = new ConnectivityService();
