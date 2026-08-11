import { API } from '../../lib/api';
import type { ConnectionStatus } from '../db/types';

type Listener = (status: ConnectionStatus) => void;

export class ConnectivityService {
  private status: ConnectionStatus = navigator.onLine ? 'SERVER_UNAVAILABLE' : 'OFFLINE';
  private listeners = new Set<Listener>();
  private timer?: number;
  private started = false;
  private probing?: Promise<boolean>;

  get current() {
    return this.status;
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  set(status: ConnectionStatus) {
    if (this.status === status) return;
    this.status = status;
    this.listeners.forEach((listener) => listener(status));
    if (this.started) this.schedule();
  }

  probe() {
    if (this.probing) return this.probing;
    this.probing = this.runProbe().finally(() => {
      this.probing = undefined;
    });
    return this.probing;
  }

  private async runProbe() {
    if (!navigator.onLine) {
      this.set('OFFLINE');
      return false;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(`${API}/health`, { cache: 'no-store', signal: controller.signal });
      if (!response.ok || !(response.headers.get('content-type') ?? '').includes('application/json')) throw new Error();
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
    if (this.started) return;
    this.started = true;
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    void this.probe().finally(() => this.schedule());
  }

  stop() {
    if (!this.started) return;
    this.started = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }

  private schedule() {
    if (!this.started) return;
    if (this.timer) clearTimeout(this.timer);
    const delay = this.status === 'ONLINE' ? 60000 : 20000;
    this.timer = window.setTimeout(() => void this.probe().finally(() => this.schedule()), delay);
  }

  private handleOnline = () => void this.probe();
  private handleOffline = () => this.set('OFFLINE');
}

export const connectivityService = new ConnectivityService();
