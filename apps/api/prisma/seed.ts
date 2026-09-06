import { PrismaClient, UnitType } from '@prisma/client';
import { hash } from 'argon2';
const db = new PrismaClient();
import {
  adminPermissionCodes,
  managerPermissionCodes,
  permissionDefinitions,
} from '../src/permissions/permission-definitions';

async function main() {
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password || password.length < 10)
    throw new Error('SEED_ADMIN_PASSWORD es obligatoria y debe tener al menos 10 caracteres');
  const company = await db.company.upsert({
    where: { cuit: '30-00000000-0' },
    update: {},
    create: { name: 'El Rincón de los Nietos', legalName: 'El Rincón de los Nietos', cuit: '30-00000000-0' },
  });
  const principalBranch = await db.branch.upsert({
    where: { companyId_code: { companyId: company.id, code: 'SUC-001' } },
    update: { name: 'Sucursal Principal', active: true, deletedAt: null },
    create: {
      companyId: company.id,
      name: 'Sucursal Principal',
      code: 'SUC-001',
      address: 'Dirección editable',
      city: 'Ciudad',
      province: 'Buenos Aires',
    },
  });
  // Remove only the legacy demo branches created by earlier development seeds.
  await db.branch.updateMany({
    where: { companyId: company.id, code: { in: ['SUC-1', 'SUC-2', 'SUC-3'] } },
    data: { active: false, deletedAt: new Date() },
  });
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
  const roleCodes = ['SUPER_ADMIN', 'ADMIN', 'ENCARGADO', 'CAJERO', 'REPOSITOR'];
  const roles = await Promise.all(
    roleCodes.map((code) =>
      db.role.upsert({
        where: { companyId_code: { companyId: company.id, code } },
        update: {},
        create: { companyId: company.id, code, name: code.replace('_', ' '), systemRole: true },
      }),
    ),
  );
  await db.rolePermission.createMany({
    data: permissions.map((p) => ({ roleId: roles[0].id, permissionId: p.id })),
    skipDuplicates: true,
  });
  const permissionByCode = new Map(permissions.map((permission) => [permission.code, permission.id]));
  for (const [roleIndex, codes] of [
    [1, adminPermissionCodes],
    [2, managerPermissionCodes],
  ] as const) {
    await db.rolePermission.createMany({
      data: codes.map((code) => ({ roleId: roles[roleIndex].id, permissionId: permissionByCode.get(code)! })),
      skipDuplicates: true,
    });
  }
  await db.rolePermission.createMany({
    data: ['panels.cashier', 'sales.access', 'cashSessions.open', 'cashSessions.close', 'sales.create', 'sales.view', 'terminals.view', 'paymentMethods.view'].map((code) => ({
      roleId: roles[3].id,
      permissionId: permissionByCode.get(code)!,
    })),
    skipDuplicates: true,
  });
  const admin = await db.user.upsert({
    where: { companyId_username: { companyId: company.id, username: 'admin' } },
    update: { passwordHash: await hash(password) },
    create: {
      companyId: company.id,
      username: 'admin',
      email: 'admin@rincon.local',
      passwordHash: await hash(password),
      firstName: 'Administrador',
      lastName: 'General',
    },
  });
  await db.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: roles[0].id } },
    update: {},
    create: { userId: admin.id, roleId: roles[0].id },
  });
  await db.userBranchAccess.upsert({
    where: { userId_branchId: { userId: admin.id, branchId: principalBranch.id } },
    update: { companyId: company.id },
    create: { userId: admin.id, branchId: principalBranch.id, companyId: company.id },
  });
  const names = [
    'Almacén',
    'Bebidas',
    'Lácteos',
    'Fiambres',
    'Congelados',
    'Limpieza',
    'Perfumería',
    'Golosinas',
    'Librería',
    'Otros',
  ];
  const categories = await Promise.all(
    names.map((name, sortOrder) =>
      db.category
        .findFirst({ where: { companyId: company.id, name, parentId: null } })
        .then((found) => found ?? db.category.create({ data: { companyId: company.id, name, sortOrder } })),
    ),
  );
  const gaseosas =
    (await db.category.findFirst({ where: { companyId: company.id, name: 'Gaseosas', parentId: categories[1].id } })) ??
    (await db.category.create({ data: { companyId: company.id, name: 'Gaseosas', parentId: categories[1].id } }));
  const brands = await Promise.all(
    ['La Serenísima', 'Coca-Cola', 'Marolio'].map((name) =>
      db.brand.upsert({
        where: { companyId_name: { companyId: company.id, name } },
        update: {},
        create: { companyId: company.id, name },
      }),
    ),
  );
  const demos = [
    {
      internalCode: 'BEB-001',
      name: 'Coca Cola 2.25L',
      categoryId: categories[1].id,
      brandId: brands[1].id,
      unitType: UnitType.UNIT,
      barcode: '7790000000010',
      cost: 1800,
      price: 3000,
      subcategoryId: gaseosas.id,
    },
    {
      internalCode: 'LAC-001',
      name: 'Leche entera 1 L',
      categoryId: categories[2].id,
      brandId: brands[0].id,
      unitType: UnitType.LITER,
      barcode: '7790000000027',
      cost: 900,
      price: 1350,
    },
    {
      internalCode: 'ALM-001',
      name: 'Harina 000 1 kg',
      categoryId: categories[0].id,
      brandId: brands[2].id,
      unitType: UnitType.KG,
      barcode: '7790000000034',
      cost: 700,
      price: 1050,
    },
  ];
  for (const d of demos) {
    const p = await db.product.upsert({
      where: { companyId_internalCode: { companyId: company.id, internalCode: d.internalCode } },
      update: {},
      create: {
        companyId: company.id,
        internalCode: d.internalCode,
        name: d.name,
        categoryId: d.categoryId,
        subcategoryId: 'subcategoryId' in d ? d.subcategoryId : undefined,
        brandId: d.brandId,
        unitType: d.unitType,
        barcodes: { create: { companyId: company.id, barcode: d.barcode, isPrimary: true } },
      },
    });
    await db.branchProduct.createMany({
      data: [
        {
          branchId: principalBranch.id,
          productId: p.id,
          cost: d.cost,
          salePrice: d.price,
          margin: 50,
          stockMinimum: 10,
        },
      ],
      skipDuplicates: true,
    });
  }
  await db.priceList.upsert({
    where: { companyId_code: { companyId: company.id, code: 'MINORISTA' } },
    update: { isDefault: true, active: true },
    create: {
      companyId: company.id,
      code: 'MINORISTA',
      name: 'Minorista',
      description: 'Precio minorista predeterminado',
      isDefault: true,
    },
  });
  await db.terminal.upsert({
    where: { branchId_code: { branchId: principalBranch.id, code: 'C01' } },
    update: { active: true },
    create: { companyId: company.id, branchId: principalBranch.id, code: 'C01', name: 'Caja 1' },
  });
  for (const [sortOrder, code, name, requiresReference] of [
    [10, 'CASH', 'Efectivo', false],
    [20, 'DEBIT', 'Débito', true],
    [30, 'CREDIT', 'Crédito', true],
    [40, 'MERCADO_PAGO', 'Mercado Pago', true],
    [50, 'TRANSFER', 'Transferencia', true],
    [60, 'OTHER', 'Otro', false],
  ] as const)
    await db.paymentMethod.upsert({
      where: { companyId_code: { companyId: company.id, code } },
      update: { name, sortOrder, requiresReference, active: true },
      create: { companyId: company.id, code, name, sortOrder, requiresReference },
    });
  console.log('Seed completado: admin / contraseña definida en SEED_ADMIN_PASSWORD');
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
