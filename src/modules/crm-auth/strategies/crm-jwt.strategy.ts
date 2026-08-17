import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { ProjectsUtilsService } from '../../../database/projects-utils.service';

@Injectable()
export class CrmJwtStrategy extends PassportStrategy(Strategy, 'crm-jwt') {
    constructor(
        private configService: ConfigService,
        private projectsUtilsService: ProjectsUtilsService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('JWT_SECRET'),
            passReqToCallback: true,
        });
    }

    async validate(req: any, payload: any) {
        if (!payload || !payload.sub || !payload.crmRole) {
            throw new UnauthorizedException('Invalid CRM token');
        }

        const CrmUserModel = this.projectsUtilsService.getCrmUserModel();
        const user = await CrmUserModel.findById(payload.sub).select('-passwordHash');

        if (!user) {
            throw new UnauthorizedException('CRM user not found');
        }

        if (!user.isActive) {
            throw new UnauthorizedException('CRM user account is inactive');
        }

        // Attach to req.crmUser for CrmRolesGuard
        req.crmUser = user;
        return user;
    }
}
