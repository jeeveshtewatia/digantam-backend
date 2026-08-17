import {
    Injectable,
    ConflictException,
    UnauthorizedException,
    ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { ProjectsUtilsService } from '../../database/projects-utils.service';
import { CrmLoginDto } from './dto/crm-login.dto';
import { CrmRegisterDto } from './dto/crm-register.dto';
import { CrmRole } from '../../config/constants';
import { EmailService } from '../email/email.service';

@Injectable()
export class CrmAuthService {
    constructor(
        private projectsUtilsService: ProjectsUtilsService,
        private jwtService: JwtService,
        private emailService: EmailService,
        private configService: ConfigService,
    ) { }

    async register(dto: CrmRegisterDto, currentUser?: any) {
        const CrmUserModel = this.projectsUtilsService.getCrmUserModel();

        const companyId = dto.companyId || 'default';

        // Only ADMIN or HR can register new users
        if (currentUser && ![CrmRole.ADMIN, CrmRole.HR].includes(currentUser.role)) {
            throw new ForbiddenException('Only ADMIN or HR can register CRM users');
        }

        // Check email uniqueness per company
        const existing = await CrmUserModel.findOne({ email: dto.email, companyId });
        if (existing) {
            throw new ConflictException(`Email already registered for company ${companyId}`);
        }

        const passwordHash = await bcrypt.hash(dto.password, 10);

        const now = new Date();
        const joiningMonth = now.getMonth(); // 0=Jan ... 11=Dec
        const todayDay = now.getDate();

        // Initial balance: joining on or before 10th → 2 days, after 10th → 1 day
        const initialLeaves = todayDay <= 10 ? 2 : 1;

        // Yearly quota: 2 leaves/month for full months remaining + initial portion for joining month
        const fullRemainingMonths = 11 - joiningMonth; // Months after this one
        const yearlyQuota = (fullRemainingMonths * 2) + initialLeaves;

        const user = await CrmUserModel.create({
            companyId,
            name: dto.name,
            email: dto.email,
            phoneNumber: dto.phoneNumber,
            passwordHash,
            role: dto.role || CrmRole.EMPLOYEE,
            department: dto.department,
            shiftId: dto.shiftId || null,
            leaveBalance: {
                total: initialLeaves,
                yearlyQuota,
                yearlyUsed: 0,
            },
        });

        return {
            message: 'CRM user registered successfully',
            user: this.sanitizeUser(user),
        };
    }

    async login(dto: CrmLoginDto, ip?: string, deviceId?: string) {
        const CrmUserModel = this.projectsUtilsService.getCrmUserModel();

        const user = await CrmUserModel.findOne({ email: dto.email });
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        if (!user.isActive) {
            throw new UnauthorizedException('Account is inactive');
        }

        const isValid = await bcrypt.compare(dto.password, user.passwordHash);
        if (!isValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // Save device info
        if (ip || deviceId) {
            const deviceEntry: any = { lastLogin: new Date() };
            if (ip) deviceEntry.ip = ip;
            if (deviceId) deviceEntry.deviceId = deviceId;

            const existingDevice = user.deviceInfo?.find((d: any) => d.ip === ip);
            if (!existingDevice) {
                user.deviceInfo = [...(user.deviceInfo || []), deviceEntry];
            } else {
                existingDevice.lastLogin = new Date();
            }
            await user.save();
        }

        const token = this.generateToken(user);

        return {
            message: 'Login successful',
            user: this.sanitizeUser(user),
            token,
        };
    }

    async getProfile(userId: string) {
        const CrmUserModel = this.projectsUtilsService.getCrmUserModel();
        const user = await CrmUserModel.findById(userId).select('-passwordHash');
        if (!user) {
            throw new UnauthorizedException('CRM user not found');
        }
        return user;
    }

    async forgotPassword(email: string, companyId: string) {
        const CrmUserModel = this.projectsUtilsService.getCrmUserModel();
        const CrmPasswordResetModel = this.projectsUtilsService.getCrmPasswordResetModel();

        const user = await CrmUserModel.findOne({ email, companyId });
        // Always return success to prevent email enumeration
        if (!user) return { message: 'If that email exists, a reset link has been generated' };

        // Generate random token
        const rawToken = Math.random().toString(36).slice(2) + Date.now().toString(36);
        const tokenHash = await bcrypt.hash(rawToken, 6);

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 2); // 2-hour expiry

        // Invalidate any previous unused tokens for this user
        await CrmPasswordResetModel.updateMany(
            { email, companyId, used: false },
            { used: true }
        );

        await CrmPasswordResetModel.create({ email, companyId, tokenHash, expiresAt });

        // Send the email (don't await to avoid blocking the API response)
        const frontendUrl = this.configService.get<string>('CRM_FRONTEND_URL') || 'http://localhost:3001';
        const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;
        
        this.emailService.sendEmail(email, 'Password Reset Request', 'password-reset', { 
            token: rawToken,
            resetLink 
        });

        return {
            message: 'Password reset link has been sent to your email',
            devToken: rawToken, // Kept for dev convenience
        };
    }

    async resetPassword(rawToken: string, newPassword: string) {
        const CrmPasswordResetModel = this.projectsUtilsService.getCrmPasswordResetModel();
        const CrmUserModel = this.projectsUtilsService.getCrmUserModel();

        const matchedRecord = await this.getValidTokenRecord(rawToken);
        if (!matchedRecord) {
            throw new UnauthorizedException('Invalid or expired reset token');
        }

        // Invalidate ALL tokens for this user now that password is being changed
        await CrmPasswordResetModel.updateMany(
            { email: matchedRecord.email, companyId: matchedRecord.companyId, used: false },
            { used: true }
        );

        const newHash = await bcrypt.hash(newPassword, 10);
        await CrmUserModel.findOneAndUpdate(
            { email: matchedRecord.email, companyId: matchedRecord.companyId },
            { passwordHash: newHash },
        );

        return { message: 'Password reset successfully' };
    }

    async validateResetToken(rawToken: string) {
        const record = await this.getValidTokenRecord(rawToken);
        if (!record) {
            throw new UnauthorizedException('Invalid or expired reset token');
        }
        return { message: 'Token is valid', email: record.email };
    }

    private async getValidTokenRecord(rawToken: string) {
        const CrmPasswordResetModel = this.projectsUtilsService.getCrmPasswordResetModel();
        const records = await CrmPasswordResetModel.find({
            used: false,
            expiresAt: { $gt: new Date() },
        }).sort({ createdAt: -1 }).lean();

        for (const record of records) {
            const isMatch = await bcrypt.compare(rawToken, record.tokenHash);
            if (isMatch) return record;
        }
        return null;
    }

    async changePassword(userId: string, currentPass: string, newPass: string) {
        const CrmUserModel = this.projectsUtilsService.getCrmUserModel();
        const user = await CrmUserModel.findById(userId);
        if (!user) throw new UnauthorizedException('User not found');

        const isValid = await bcrypt.compare(currentPass, user.passwordHash);
        if (!isValid) throw new ForbiddenException('Current password is incorrect');

        const newHash = await bcrypt.hash(newPass, 10);
        user.passwordHash = newHash;
        await user.save();

        return { message: 'Password changed successfully' };
    }

    private generateToken(user: any): string {
        const payload = {
            sub: user._id.toString(),
            email: user.email,
            crmRole: user.role,
            companyId: user.companyId,
        };
        return this.jwtService.sign(payload);
    }

    private sanitizeUser(user: any) {
        return {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            companyId: user.companyId,
            department: user.department,
            phoneNumber: user.phoneNumber,
            isActive: user.isActive,
        };
    }
}

