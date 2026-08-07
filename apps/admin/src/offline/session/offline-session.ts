import type { Me } from '../../lib/api';
import { offlineDb } from '../db/database';
const HOURS = 12;
export async function cacheSession(me: Me) {
  await offlineDb.usersCache.put({
    id: me.user.id,
    profile: me.user,
    permissions: me.permissions,
    company: me.company,
    branch: me.branch,
    cachedAt: new Date().toISOString(),
    offlineExpiresAt: new Date(Date.now() + HOURS * 3600000).toISOString(),
  });
  await offlineDb.settings.put({ key: 'lastUserId', value: me.user.id, updatedAt: new Date().toISOString() });
}
export async function offlineSession(): Promise<Me | undefined> {
  const setting = await offlineDb.settings.get('lastUserId');
  if (!setting) return;
  const cached = await offlineDb.usersCache.get(String(setting.value));
  if (!cached || Date.parse(cached.offlineExpiresAt) < Date.now()) return;
  return {
    user: cached.profile as Me['user'],
    permissions: cached.permissions,
    company: cached.company as Me['company'],
    branch: cached.branch as Me['branch'],
  };
}
