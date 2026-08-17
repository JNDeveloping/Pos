import { PrismaClient } from '@prisma/client';
import { SYSTEM_PERMISSIONS } from '../src/permissions/permission-definitions';
import { planPermissionSync } from '../src/permissions/permission-sync';
const db = new PrismaClient();
type Summary = { created: number; updated: number; unchanged: number; undefinedCodes: string[] };
export async function syncPermissions(client: PrismaClient = db): Promise<Summary> {
  const summary: Summary = { created: 0, updated: 0, unchanged: 0, undefinedCodes: [] };
  await client.$transaction(async (tx) => {
    const companies = await tx.company.findMany({ select: { id: true, name: true } });
    for (const company of companies) {
      const existing = await tx.permission.findMany({
        where: { companyId: company.id },
        select: { id: true, code: true, module: true, label: true, description: true, sortOrder: true, active: true },
      });
      const plan = planPermissionSync(existing, SYSTEM_PERMISSIONS);
      summary.created += plan.created.length;
      summary.updated += plan.updated.length;
      summary.unchanged += plan.unchanged.length;
      for (const definition of SYSTEM_PERMISSIONS) {
        await tx.permission.upsert({
          where: { companyId_code: { companyId: company.id, code: definition.code } },
          create: { companyId: company.id, ...definition },
          update: {
            module: definition.module,
            label: definition.label,
            description: definition.description,
            sortOrder: definition.sortOrder,
            active: definition.active,
          },
        });
      }
      for (const code of plan.undefinedCodes) summary.undefinedCodes.push(`${company.name}: ${code}`);
    }
  });
  return summary;
}
async function main() {
  console.log('Sincronizando permisos...\n');
  const result = await syncPermissions();
  console.log(`Creados: ${result.created}`);
  console.log(`Actualizados: ${result.updated}`);
  console.log(`Sin cambios: ${result.unchanged}`);
  console.log(`\nPermisos no definidos actualmente: ${result.undefinedCodes.length}`);
  for (const code of result.undefinedCodes)
    console.warn(`ADVERTENCIA: Permiso existente no definido actualmente: ${code}`);
  console.log('\nSincronización finalizada. No se eliminaron permisos, roles ni relaciones RolePermission.');
}
void main()
  .catch((error) => {
    console.error('La sincronización falló; la transacción fue revertida.', error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
