import {
    IsEnum, IsString, IsNotEmpty, IsOptional,
    IsDateString, IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeaveType, LeaveStatus } from '../../../config/constants';

export class CreateCrmLeaveDto {
    @ApiPropertyOptional({
        enum: LeaveType,
        default: LeaveType.LEAVE,
        description: 'Leave type — use LEAVE (unified type)',
    })
    @IsEnum(LeaveType)
    @IsOptional()
    type?: LeaveType;

    @ApiProperty({ example: '2026-03-10', description: 'Start date YYYY-MM-DD' })
    @IsDateString()
    startDate: string;

    @ApiProperty({ example: '2026-03-12', description: 'End date YYYY-MM-DD (same as startDate for half-day)' })
    @IsDateString()
    endDate: string;

    @ApiPropertyOptional({ example: false, description: 'Set true for half-day leave (startDate === endDate)' })
    @IsBoolean()
    @IsOptional()
    isHalfDay?: boolean;

    @ApiPropertyOptional({
        enum: ['morning', 'evening'],
        description: 'Required when isHalfDay is true',
    })
    @IsEnum(['morning', 'evening'])
    @IsOptional()
    halfDayPeriod?: 'morning' | 'evening';

    @ApiPropertyOptional({ example: 'Personal work' })
    @IsString()
    @IsOptional()
    reason?: string;

    @ApiPropertyOptional({ description: 'Target user ID (Admin/HR only)' })
    @IsString()
    @IsOptional()
    userId?: string;

    @ApiPropertyOptional({ enum: LeaveStatus, description: 'Initial status' })
    @IsEnum(LeaveStatus)
    @IsOptional()
    status?: LeaveStatus;
}

export class CancelCrmLeaveDto {
    @ApiPropertyOptional({ example: 'Plans changed' })
    @IsString()
    @IsOptional()
    cancelReason?: string;
}

export class UpdateCrmLeaveDto {
    @ApiProperty({ enum: LeaveStatus })
    @IsEnum(LeaveStatus)
    status: LeaveStatus;
}
