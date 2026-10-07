import {
  createParamDecorator, ExecutionContext, Injectable, CanActivate,
  ForbiddenException, UnauthorizedException, SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';

export interface AuthUser {
  id: number;
  role: 'user' | 'therapist' | 'admin';
  name: string;
}

export const JWT_SECRET = process.env.JWT_SECRET || 'community-physio-demo-secret';
export const JWT_EXPIRES = '12h';

export function signToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
  },
);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Array<'user' | 'therapist' | 'admin'>) => SetMetadata(ROLES_KEY, roles);

/** 登录态校验 */
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const auth: string = req.headers['authorization'] || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) throw new UnauthorizedException('缺少登录令牌');
    try {
      req.user = jwt.verify(token, JWT_SECRET) as AuthUser;
      return true;
    } catch {
      throw new UnauthorizedException('登录已过期，请重新登录');
    }
  }
}

/** 角色限制，配合 @Roles 使用（需与 AuthGuard 同时挂载） */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const req = context.switchToHttp().getRequest();
    if (!required.includes(req.user?.role)) {
      throw new ForbiddenException('当前角色无权访问该资源');
    }
    return true;
  }
}
