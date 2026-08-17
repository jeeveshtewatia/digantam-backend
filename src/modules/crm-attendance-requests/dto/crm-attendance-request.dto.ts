import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAttendanceEditRequestDto {
    @ApiProperty({ example: '2026-02-25', description: 'Date to correct (YYYY-MM-DD)' })
    @IsDateString()
    date: string;

    @ApiPropertyOptional({ example: '09:15', description: 'Requested check-in time (HH:mm)' })
    @IsString()
    @IsOptional()
    requestedCheckIn?: string;

    @ApiPropertyOptional({ example: '18:30', description: 'Requested check-out time (HH:mm)' })
    @IsString()
    @IsOptional()
    requestedCheckOut?: string;

    @ApiPropertyOptional({ example: 'https://example.com/selfie.jpg', description: 'Selfie URL for verification' })
    @IsString()
    @IsOptional()
    selfieUrl?: string;

    @ApiProperty({ example: 'Forgot to check in, was working from office' })
    @IsString()
    @IsNotEmpty()
    reason: string;
}

export class ReviewAttendanceEditRequestDto {
    @ApiPropertyOptional({ example: 'Verified with office camera' })
    @IsString()
    @IsOptional()
    reviewNote?: string;
}
