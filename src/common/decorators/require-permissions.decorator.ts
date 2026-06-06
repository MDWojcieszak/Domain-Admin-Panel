import { SetMetadata } from '@nestjs/common';

import { Permission } from '../acl/permissions';

export const PERMISSIONS_KEY = 'required_permissions';

/**
 * Guards an endpoint with one or more permissions. The caller must hold ALL of
 * them (OWNER bypasses). Resolved by PermissionsGuard against the user's groups.
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
