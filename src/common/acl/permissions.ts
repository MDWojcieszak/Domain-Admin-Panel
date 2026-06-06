/**
 * Central catalog of granular permissions (resource.action). This is the source
 * of truth: decorators reference these keys, and PermissionGroup.permissions in
 * the DB must contain only keys from here. OWNER bypasses all checks.
 */
export const PERMISSIONS = {
  SERVER_READ: 'server.read',
  SERVER_POWER: 'server.power',
  SERVER_CATEGORY_MANAGE: 'server.category.manage',
  SERVER_DISK_MANAGE: 'server.disk.manage',

  COMMAND_READ: 'command.read',
  COMMAND_EXECUTE: 'command.execute',
  COMMAND_MANAGE: 'command.manage',

  PROCESS_READ: 'process.read',

  SETTINGS_READ: 'settings.read',
  SETTINGS_MANAGE: 'settings.manage',

  TRANSFER_READ: 'transfer.read',
  TRANSFER_MANAGE: 'transfer.manage',

  ACL_MANAGE: 'acl.manage',
  ACL_ASSIGN: 'acl.assign',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

const PERMISSION_SET = new Set<string>(ALL_PERMISSIONS);

export function isValidPermission(value: string): value is Permission {
  return PERMISSION_SET.has(value);
}

/**
 * Human-friendly catalog exposed to the panel so an OWNER can compose groups.
 */
export type PermissionDescriptor = {
  key: Permission;
  resource: string;
  description: string;
};

export const PERMISSION_CATALOG: PermissionDescriptor[] = [
  { key: PERMISSIONS.SERVER_READ, resource: 'server', description: 'View servers, details and status' },
  { key: PERMISSIONS.SERVER_POWER, resource: 'server', description: 'Start / stop / reboot servers' },
  { key: PERMISSIONS.SERVER_CATEGORY_MANAGE, resource: 'server', description: 'Create and edit server categories' },
  { key: PERMISSIONS.SERVER_DISK_MANAGE, resource: 'server', description: 'Edit server disks' },

  { key: PERMISSIONS.COMMAND_READ, resource: 'command', description: 'View commands' },
  { key: PERMISSIONS.COMMAND_EXECUTE, resource: 'command', description: 'Execute commands on servers' },
  { key: PERMISSIONS.COMMAND_MANAGE, resource: 'command', description: 'Edit commands and progress markers' },

  { key: PERMISSIONS.PROCESS_READ, resource: 'process', description: 'View processes and their logs' },

  { key: PERMISSIONS.SETTINGS_READ, resource: 'settings', description: 'View server settings' },
  { key: PERMISSIONS.SETTINGS_MANAGE, resource: 'settings', description: 'Change server settings' },

  { key: PERMISSIONS.TRANSFER_READ, resource: 'transfer', description: 'View server transfers' },
  { key: PERMISSIONS.TRANSFER_MANAGE, resource: 'transfer', description: 'Create and edit server transfers' },

  { key: PERMISSIONS.ACL_MANAGE, resource: 'acl', description: 'Create and edit permission groups' },
  { key: PERMISSIONS.ACL_ASSIGN, resource: 'acl', description: 'Assign users to permission groups' },
];
