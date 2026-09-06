-- Panel access is explicit so a role can operate the cashier workspace without entering owner administration.
INSERT INTO "Permission" ("id", "companyId", "code", "module", "label", "description", "sortOrder", "active", "createdAt", "updatedAt")
SELECT gen_random_uuid(), c."id", 'panels.cashier', 'PANELS', 'Ingresar al panel de caja',
       'Permite abrir el POS y las herramientas operativas autorizadas para caja', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Company" c
ON CONFLICT ("companyId", "code") DO NOTHING;

INSERT INTO "Permission" ("id", "companyId", "code", "module", "label", "description", "sortOrder", "active", "createdAt", "updatedAt")
SELECT gen_random_uuid(), c."id", 'panels.admin', 'PANELS', 'Ingresar al panel de administración',
       'Permite abrir el panel del dueño y sus secciones autorizadas', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Company" c
ON CONFLICT ("companyId", "code") DO NOTHING;

-- Preserve current access: POS users receive the cashier panel and roles with management capabilities receive admin.
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT DISTINCT rp."roleId", target."id"
FROM "RolePermission" rp
JOIN "Permission" current_permission ON current_permission."id" = rp."permissionId"
JOIN "Role" role ON role."id" = rp."roleId"
JOIN "Permission" target ON target."companyId" = role."companyId" AND target."code" = 'panels.cashier'
WHERE current_permission."code" = 'sales.access'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT DISTINCT rp."roleId", target."id"
FROM "RolePermission" rp
JOIN "Permission" current_permission ON current_permission."id" = rp."permissionId"
JOIN "Role" role ON role."id" = rp."roleId"
JOIN "Permission" target ON target."companyId" = role."companyId" AND target."code" = 'panels.admin'
WHERE current_permission."code" IN ('dashboard.view', 'users.view', 'branches.view', 'roles.view', 'audit.view', 'branches.settings')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
