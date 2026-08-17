import { IsString, IsNotEmpty, IsNumber, IsOptional, Min, Max, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateCrmShiftDto {
    @ApiProperty({ example: 'Morning Shift' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiPropertyOptional({ enum: ['fixed', 'flexible'], default: 'fixed' })
    @IsEnum(['fixed', 'flexible'])
    @IsOptional()
    shiftType?: 'fixed' | 'flexible';

    @ApiProperty({ example: '09:00', description: 'Start time in HH:mm format' })
    @IsString()
    @IsNotEmpty()
    startTime: string;

    @ApiProperty({ example: '18:00', description: 'End time in HH:mm format' })
    @IsString()
    @IsNotEmpty()
    endTime: string;

    @ApiPropertyOptional({ example: 10, description: 'Grace period in minutes' })
    @IsNumber()
    @Min(0)
    @Max(120)
    @Type(() => Number)
    @IsOptional()
    graceMinutes?: number;

    @ApiPropertyOptional({ example: 480, description: 'Working minutes per day (default 480 = 8h)' })
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    @IsOptional()
    workingMinutes?: number;

    @ApiPropertyOptional({ example: 240, description: 'Minutes to count as half day (default 240 = 4h)' })
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    @IsOptional()
    halfDayThresholdMinutes?: number;

    @ApiPropertyOptional({ example: 0, description: 'Additional minutes beyond workingMinutes to trigger overtime' })
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    @IsOptional()
    overtimeThresholdMinutes?: number;

    @ApiPropertyOptional({ example: 'default' })
    @IsString()
    @IsOptional()
    companyId?: string;
}
