import { PrismaClient, Unit } from '@prisma/client';
import { hash } from 'argon2';
const db = new PrismaClient();
async function main() {
  const company = await db.company.upsert({ where: { taxId: '30-00000000-0' }, update: {}, create: { name: 'El Rincón de los Nietos', taxId: '30-00000000-0' } });
  const branchData = [['CENTRO', 'Sucursal Centro'], ['PLAZA', 'Sucursal Plaza'], ['NORTE', 'Sucursal Norte']];
  const branches = await Promise.all(branchData.map(([code, name]) => db.branch.upsert({ where: { companyId_code: { companyId: company.id, code } }, update: {}, create: { companyId: company.id, code, name, province: 'Buenos Aires' } })));
  const permissionData: Record<string, string> = { 'productos.ver': 'Consultar productos', 'productos.crear': 'Crear productos', 'productos.editar': 'Editar productos', 'productos.eliminar': 'Desactivar productos', 'usuarios.administrar': 'Administrar usuarios', 'sucursales.administrar': 'Administrar sucursales', 'ventas.crear': 'Crear ventas', 'caja.abrir': 'Abrir caja', 'stock.ajustar': 'Ajustar stock', 'reportes.ver': 'Consultar reportes' };
  const permissions = await Promise.all(Object.entries(permissionData).map(([code, description]) => db.permission.upsert({ where: { companyId_code: { companyId: company.id, code } }, update: { description }, create: { companyId: company.id, code, description } })));
  const roleCodes = ['SUPER_ADMIN', 'ADMIN', 'ENCARGADO', 'CAJERO', 'REPOSITOR'];
  const roles = await Promise.all(roleCodes.map((code) => db.role.upsert({ where: { companyId_code: { companyId: company.id, code } }, update: {}, create: { companyId: company.id, code, name: code.replace('_', ' '), system: true } })));
  const superAdmin = roles[0];
  await db.rolePermission.createMany({ data: permissions.map((permission) => ({ roleId: superAdmin.id, permissionId: permission.id })), skipDuplicates: true });
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Cambiar123!';
  await db.user.upsert({ where: { companyId_username: { companyId: company.id, username: 'admin' } }, update: {}, create: { companyId: company.id, roleId: superAdmin.id, username: 'admin', email: 'admin@rincondelosnietos.local', passwordHash: await hash(password), firstName: 'Administrador', lastName: 'General' } });
  const names = ['Bebidas', 'Almacén', 'Lácteos', 'Fiambres', 'Congelados', 'Limpieza', 'Perfumería', 'Golosinas', 'Librería', 'Carbón y Gas'];
  const categories = await Promise.all(names.map((name) => db.category.upsert({ where: { companyId_slug: { companyId: company.id, slug: name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-') } }, update: {}, create: { companyId: company.id, name, slug: name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-') } })));
  const product = await db.product.upsert({ where: { companyId_internalCode: { companyId: company.id, internalCode: 'BEB-001' } }, update: {}, create: { companyId: company.id, categoryId: categories[0].id, internalCode: 'BEB-001', name: 'Gaseosa cola 2,25 L', unit: Unit.UNIT, cost: 1800, generalPrice: 3000, barcodes: { create: { code: '7790000000010', primary: true } } } });
  await db.branchProduct.createMany({ data: branches.map((branch) => ({ branchId: branch.id, productId: product.id, minimumStock: 10 })), skipDuplicates: true });
  console.log(`Seed listo. Usuario: admin / contraseña: ${password}`);
}
main().finally(() => db.$disconnect());
