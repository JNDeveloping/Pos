import { rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const obsoletePaths = [
  'apps/admin/src/offline',
  'apps/admin/src/components/SyncIndicator.tsx',
  'apps/admin/tests/offline-pwa.mjs',
  'apps/api/src/modules/sync',
];

for (const relativePath of obsoletePaths) {
  await rm(resolve(root, relativePath), { recursive: true, force: true });
}

console.log('Limpieza legacy completada: no quedan fuentes IndexedDB/SyncService del navegador.');
