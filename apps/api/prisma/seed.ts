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
  'products.delete',
  'categories.view',
  'categories.manage',
  'brands.view',
  'brands.manage',
  'prices.view',
  'prices.update',
  'stock.view',
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
  const branches = await Promise.all(
    ['Sucursal 1', 'Sucursal 2', 'Sucursal 3'].map((name, i) =>
      db.branch.upsert({
        where: { companyId_code: { companyId: company.id, code: `SUC-${i + 1}` } },
        update: {},
        create: {
          companyId: company.id,
          name,
          code: `SUC-${i + 1}`,
          address: `Dirección editable ${i + 1}`,
          city: 'Ciudad',
          province: 'Buenos Aires',
        },
      }),
    ),
  );
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
      name: 'Gaseosa Cola 2,25 L',
      categoryId: categories[1].id,
      brandId: brands[1].id,
      unitType: UnitType.UNIT,
      barcode: '7790000000010',
      cost: 1800,
      price: 3000,
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
        brandId: d.brandId,
        unitType: d.unitType,
        barcodes: { create: { companyId: company.id, barcode: d.barcode, isPrimary: true } },
      },
    });
    await db.branchProduct.createMany({
      data: branches.map((b) => ({
        branchId: b.id,
        productId: p.id,
        cost: d.cost,
        salePrice: d.price,
        margin: 50,
        stockMinimum: 10,
      })),
      skipDuplicates: true,
    });
  }
  console.log('Seed completado: admin / contraseña definida en SEED_ADMIN_PASSWORD');
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
