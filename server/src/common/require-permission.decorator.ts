import { SetMetadata } from '@nestjs/common';
import type { Permission } from './permissions';

export const PERMISSION_KEY = 'required_permission';
/** Controller/handler'a gereken izni işaretler; RbacGuard okur. */
export const RequirePermission = (perm: Permission) => SetMetadata(PERMISSION_KEY, perm);
