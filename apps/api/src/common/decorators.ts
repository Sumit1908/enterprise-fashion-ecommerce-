import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const PERMISSIONS_KEY = 'permissions';
/** Require ALL listed permission keys, e.g. @RequirePermissions('product:create'). */
export const RequirePermissions = (...keys: string[]) => SetMetadata(PERMISSIONS_KEY, keys);

export interface AuthUser {
  id: string;
  kind: 'CUSTOMER' | 'STAFF';
  email: string | null;
  isSuperAdmin: boolean;
  permissions: string[];
  roles: string[];
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    return data ? request.user?.[data] : request.user;
  },
);
