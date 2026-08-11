import { PrismaClient, UnitType } from '@prisma/client';
import { hash } from 'argon2';
const db = new PrismaClient();
const permissionCodes = [
  'dashboard.view',
  'branches.view',
  'branches.create',
  'branches.update',
  'branches.delete',
  'users.view',
  'users.create',
  'users.update',
  'users.delete',
  'roles.view',
  'roles.manage',
  'products.view',
  'products.create',
  'products.update',
  'products.disable',
  'products.import',
  'products.export',
  'categories.view',
  'categories.manage',
  'brands.view',
  'brands.manage',
  'prices.view',
  'prices.update',
  'prices.bulkUpdate',
  'costs.view',
  'costs.update',
  'costs.bulkUpdate',
  'labels.view',
  'labels.generate',
  'audit.view',
  'branches.settings',
  'priceLists.view',
  'priceLists.manage',
  'stock.view',
  'suppliers.view',
  'suppliers.create',
  'suppliers.update',
  'suppliers.disable',
  'purchases.view',
  'purchases.create',
  'purchases.update',
  'purchases.confirm',
  'purchases.cancel',
  'purchaseOrders.view',
  'purchaseOrders.manage',
  'invoiceAI.use',
  'invoiceAI.review',
  'costs.applyFromPurchase',
];
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
    permissionCodes.map((code) =>
      db.permission.upsert({
        where: { companyId_code: { companyId: company.id, code } },
        update: {},
        create: { companyId: company.id, code, description: code },
      }),
    ),
  );
  const roleCodes = ['SUPER_ADMIN', 'ADMIN', 'ENCARGADO', 'CAJERO', 'REPOSITOR'];
  const roles = await Promise.all(
    roleCodes.map((code) =>
      db.role.upsert({
        where: { companyId_code: { companyId: company.id, code } },
        update: {},
        create: { companyId: company.id, code, name: code.replace('_', ' ') },
      }),
    ),
  );
  await db.rolePermission.createMany({
    data: permissions.map((p) => ({ roleId: roles[0].id, permissionId: p.id })),
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
  const gaseosas = await db.category.findFirst({ where: { companyId: company.id, name: 'Gaseosas', parentId: categories[1].id } }) ?? await db.category.create({ data: { companyId: company.id, name: 'Gaseosas', parentId: categories[1].id } });
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
    create: { companyId: company.id, code: 'MINORISTA', name: 'Minorista', description: 'Precio minorista predeterminado', isDefault: true },
  });
  console.log('Seed completado: admin / contraseña definida en SEED_ADMIN_PASSWORD');
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
