import { IsEmail, IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CrmRole } from '../../../config/constants';

export class CrmRegisterDto {
    @ApiProperty({ example: 'John Doe' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ example: 'john.doe@company.com' })
    @IsEmail()
    email: string;

    @ApiPropertyOptional({ example: '+919876543210' })
    @IsString()
    @IsOptional()
    phoneNumber?: string;

    @ApiProperty({ example: 'Password@123' })
    @IsString()
    @IsNotEmpty()
    password: string;

    @ApiPropertyOptional({ enum: CrmRole, default: CrmRole.EMPLOYEE })
    @IsEnum(CrmRole)
    @IsOptional()
    role?: CrmRole;

    @ApiPropertyOptional({ example: 'Engineering' })
    @IsString()
    @IsOptional()
    department?: string;

    @ApiPropertyOptional({ example: 'shift_id_here' })
    @IsString()
    @IsOptional()
    shiftId?: string;

    @ApiPropertyOptional({ example: 'default' })
    @IsString()
    @IsOptional()
    companyId?: string;
}
