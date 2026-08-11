import { access, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const forbidden = [
  'apps/admin/src/offline',
  'apps/api/src/modules/sync',
];
for (const relativePath of forbidden) {
  try {
    await access(resolve(root, relativePath), constants.F_OK);
    throw new Error(`Fuente obsoleta detectada: ${relativePath}. Ejecute npm run clean:legacy.`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Fuente obsoleta')) throw error;
  }
}

const migrations = (await readdir(resolve(root, 'apps/api/prisma/migrations'), { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const requiredMigration = '20260812120000_message3_commercial_catalog';
if (!migrations.includes(requiredMigration)) {
  throw new Error(`Checkout incompleto: falta la migración ${requiredMigration}. Actualice el código antes de desplegar.`);
}
console.log(`Release verificada: ${migrations.length} migraciones y sin fuentes offline obsoletas.`);
