import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { ProjectsUtilsService } from '../../../database/projects-utils.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private projectsUtilsService: ProjectsUtilsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException('Invalid token payload: missing user ID');
    }

    try {
      const UserModel = this.projectsUtilsService.getUserModel();
      const user = await UserModel.findById(payload.sub).select('-password');

      if (!user) {
        throw new UnauthorizedException(`User not found with ID: ${payload.sub}`);
      }

      if (!user.is_active) {
        throw new UnauthorizedException('User account is inactive');
      }

      return user;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException(`Error validating user: ${error.message}`);
    }
  }
}
