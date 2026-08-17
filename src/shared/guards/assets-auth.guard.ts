import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class AssetsAuthGuard extends AuthGuard(['crm-jwt', 'jwt']) {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
        try {
          // Token provided, try to authenticate
          const result = await super.canActivate(context);
          return !!result;
        } catch (error) {
          // Invalid token, but it's public endpoint so allow request
          // We return true so the request continues, but req.user/crmUser will be empty
          return true;
        }
      }
      // No token, allow request (public endpoint)
      return true;
    }

    // Not public, use standard multi-strategy authentication
    return super.canActivate(context) as Promise<boolean>;
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
        return undefined;
      }

      // For protected endpoints, throw error
      throw new UnauthorizedException(
        `Invalid token or user not authenticated: ${info?.message || 'Unknown error'}`,
      );
    }
    return user;
  }
}
