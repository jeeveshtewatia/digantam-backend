import { IsOptional, IsString, IsEnum, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CrmRole } from '../../../config/constants';

export class UpdateCrmUserDto {
    @IsOptional()
    name?: string;

    @ApiPropertyOptional({ example: '+919876543210' })
    @IsString()
    @IsOptional()
    phoneNumber?: string;

    @ApiPropertyOptional({ enum: CrmRole })
    @IsEnum(CrmRole)
    @IsOptional()
    role?: CrmRole;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    department?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    shiftId?: string;

    @ApiPropertyOptional()
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
