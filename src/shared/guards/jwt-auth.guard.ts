import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      // For public endpoints, try to authenticate if token is provided
      // but don't fail if no token (optional authentication)
      const request = context.switchToHttp().getRequest();
      const authHeader = request.headers?.authorization;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        // Token provided, try to authenticate (but don't throw if invalid)
        const result = super.canActivate(context);
        if (result instanceof Promise) {
          return result.catch(() => {
            // Invalid token, but it's public endpoint so allow request
            return true;
          });
        }
        return result;
      }
      // No token, allow request (public endpoint)
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err, user, info, context) {
    if (err) {
      throw err;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context?.getHandler(),
      context?.getClass(),
    ]);

    if (!user) {
      if (isPublic) {
        // For public endpoints, return undefined instead of throwing
        // This allows @CurrentUser() to work when token is provided
        return undefined;
      }

      // For protected endpoints, throw error
      if (info?.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token has expired');
      }
      if (info?.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid token format');
      }
      if (info?.name === 'NotBeforeError') {
        throw new UnauthorizedException('Token not active yet');
      }
      throw new UnauthorizedException(`Invalid token or user not authenticated: ${info?.message || 'Unknown error'}`);
    }
    return user;
  }
}
