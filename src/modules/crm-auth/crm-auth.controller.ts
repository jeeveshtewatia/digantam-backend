import {
    Controller,
    Post,
    Get,
    Body,
    UseGuards,
    Req,
    HttpCode,
    HttpStatus,
    Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { IsEmail, IsString, MinLength, IsNotEmpty } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { CrmAuthService } from './crm-auth.service';
import { CrmLoginDto } from './dto/crm-login.dto';
import { CrmRegisterDto } from './dto/crm-register.dto';
import { Public } from '../../shared/decorators/public.decorator';
import { CrmRolesGuard } from '../../shared/guards/crm-roles.guard';
import { CrmRoles } from '../../shared/decorators/crm-roles.decorator';
import { CrmRole } from '../../config/constants';

class ForgotPasswordDto {
    @ApiProperty({ example: 'employee@company.com' })
    @IsEmail()
    email: string;
}

class ResetPasswordDto {
    @ApiProperty({ description: 'Reset token received from forgot-password' })
    @IsString()
    @IsNotEmpty()
    token: string;

    @ApiProperty({ example: 'NewStrongPass@123', minLength: 6 })
    @IsString()
    @MinLength(6)
    newPassword: string;
}

class ChangePasswordDto {
    @ApiProperty({ example: 'OldPass@123' })
    @IsString()
    @IsNotEmpty()
    currentPassword: string;

    @ApiProperty({ example: 'NewStrongPass@123', minLength: 6 })
    @IsString()
    @MinLength(6)
    newPassword: string;
}

@ApiTags('CRM Auth')
@Controller('crm/auth')
@Public()
export class CrmAuthController {
    constructor(private readonly crmAuthService: CrmAuthService) { }

    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'CRM Employee Login' })
    @ApiResponse({ status: 200, description: 'Login successful with JWT token' })
    @ApiResponse({ status: 401, description: 'Invalid credentials' })
    async login(@Body() dto: CrmLoginDto, @Req() req: any) {
        const ip = req.ip || req.headers['x-forwarded-for'];
        const deviceId = req.headers['x-device-id'];
        return this.crmAuthService.login(dto, ip, deviceId);
    }

    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Post('register')
    @UseGuards(AuthGuard('crm-jwt'), CrmRolesGuard)
    @CrmRoles(CrmRole.ADMIN, CrmRole.HR)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Register a new CRM employee (Admin/HR only)' })
    @ApiResponse({ status: 201, description: 'CRM user registered successfully' })
    @ApiResponse({ status: 409, description: 'Email already registered' })
    async register(@Body() dto: CrmRegisterDto, @Req() req: any) {
        return this.crmAuthService.register(dto, req.crmUser);
    }

    @Get('profile')
    @UseGuards(AuthGuard('crm-jwt'))
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Get current CRM user profile' })
    @ApiResponse({ status: 200, description: 'Profile returned' })
    async getProfile(@Req() req: any) {
        return this.crmAuthService.getProfile(req.crmUser._id.toString());
    }

    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Post('forgot-password')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Request password reset token (check server logs for token)' })
    async forgotPassword(
        @Body() dto: ForgotPasswordDto,
        @Query('companyId') companyId = 'default',
    ) {
        return this.crmAuthService.forgotPassword(dto.email, companyId);
    }

    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Reset password using the token from forgot-password' })
    async resetPassword(@Body() dto: ResetPasswordDto) {
        return this.crmAuthService.resetPassword(dto.token, dto.newPassword);
    }

    @Get('validate-reset-token')
    @ApiOperation({ summary: 'Validate if a reset token is still valid' })
    async validateToken(@Query('token') token: string) {
        return this.crmAuthService.validateResetToken(token);
    }

    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Post('change-password')
    @UseGuards(AuthGuard('crm-jwt'))
    @ApiBearerAuth('JWT-auth')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Change current user password' })
    async changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
        return this.crmAuthService.changePassword(
            req.crmUser._id.toString(),
            dto.currentPassword,
            dto.newPassword,
        );
    }
}
