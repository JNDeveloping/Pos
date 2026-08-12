import type { PermissionDefinition } from './permission-definitions';
export type ExistingPermission = {
  code: string;
  module: string;
  label: string;
  description: string;
  sortOrder: number;
  active: boolean;
};
export type PermissionPlan = { created: string[]; updated: string[]; unchanged: string[]; undefinedCodes: string[] };
export const metadataMatches = (current: ExistingPermission, definition: PermissionDefinition) =>
  current.module === definition.module &&
  current.label === definition.label &&
  current.description === definition.description &&
  current.sortOrder === definition.sortOrder &&
  current.active === definition.active;
export function planPermissionSync(
  existing: ExistingPermission[],
  definitions: PermissionDefinition[],
): PermissionPlan {
  const byCode = new Map(existing.map((permission) => [permission.code, permission])),
    defined = new Set(definitions.map((permission) => permission.code));
  const plan: PermissionPlan = { created: [], updated: [], unchanged: [], undefinedCodes: [] };
  for (const definition of definitions) {
    const current = byCode.get(definition.code);
    if (!current) plan.created.push(definition.code);
    else if (metadataMatches(current, definition)) plan.unchanged.push(definition.code);
    else plan.updated.push(definition.code);
  }
  plan.undefinedCodes = existing
    .filter((permission) => !defined.has(permission.code))
    .map((permission) => permission.code);
  return plan;
}
