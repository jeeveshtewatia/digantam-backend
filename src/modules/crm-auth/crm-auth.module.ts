import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { CrmAuthController } from './crm-auth.controller';
import { CrmAuthService } from './crm-auth.service';
import { CrmJwtStrategy } from './strategies/crm-jwt.strategy';
import { DatabaseModule } from '../../database/database.module';

@Module({
    imports: [
        DatabaseModule,
        PassportModule,
        JwtModule.registerAsync({
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET'),
                signOptions: {
                    expiresIn: configService.get<string>('JWT_EXPIRES_IN', '7d'),
                },
            }),
        }),
    ],
    controllers: [CrmAuthController],
    providers: [CrmAuthService, CrmJwtStrategy],
    exports: [CrmAuthService, CrmJwtStrategy],
})
export class CrmAuthModule { }
