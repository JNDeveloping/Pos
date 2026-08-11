import { PrismaClient } from '@prisma/client';
import {
  adminPermissionCodes,
  managerPermissionCodes,
  permissionDefinitions,
} from '../src/permissions/permission-definitions';
const db = new PrismaClient();
async function main() {
  const companies = await db.company.findMany({ select: { id: true } });
  for (const company of companies) {
    const permissions = await Promise.all(
      permissionDefinitions.map((definition) =>
        db.permission.upsert({
          where: { companyId_code: { companyId: company.id, code: definition.code } },
          update: {
            module: definition.module,
            label: definition.label,
            description: definition.description,
            sortOrder: definition.sortOrder,
          },
          create: { companyId: company.id, ...definition },
        }),
      ),
    );
    const byCode = new Map(permissions.map((p) => [p.code, p.id]));
    const roles = await db.role.findMany({
      where: { companyId: company.id, code: { in: ['SUPER_ADMIN', 'ADMIN', 'ENCARGADO', 'CAJERO', 'REPOSITOR'] } },
    });
    for (const role of roles) {
      await db.role.update({ where: { id: role.id }, data: { systemRole: true } });
      const codes =
        role.code === 'SUPER_ADMIN'
          ? permissionDefinitions.map((p) => p.code)
          : role.code === 'ADMIN'
            ? adminPermissionCodes
            : role.code === 'ENCARGADO'
              ? managerPermissionCodes
              : [];
      if (codes.length)
        await db.rolePermission.createMany({
          data: codes.map((code) => ({ roleId: role.id, permissionId: byCode.get(code)! })),
          skipDuplicates: true,
        });
    }
  }
  console.log(`Permisos sincronizados para ${companies.length} empresa(s), sin eliminar asignaciones.`);
}
main().finally(() => db.$disconnect());
