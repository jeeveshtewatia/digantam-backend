import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CrmCheckInDto {
    @ApiProperty({ example: 19.0760 })
    @IsNumber()
    @Type(() => Number)
    lat: number;

    @ApiProperty({ example: 72.8777 })
    @IsNumber()
    @Type(() => Number)
    lng: number;

    @ApiPropertyOptional({ example: 'device-123' })
    @IsString()
    @IsOptional()
    deviceId?: string;

    @ApiPropertyOptional({ example: false })
    @IsBoolean()
    @IsOptional()
    isWFH?: boolean;

    @ApiPropertyOptional({ example: 'https://example.com/selfie.jpg' })
    @IsString()
    @IsOptional()
    selfieUrl?: string;
}

export class CrmCheckOutDto {
    @ApiPropertyOptional({ example: 19.0760 })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    lat?: number;

    @ApiPropertyOptional({ example: 72.8777 })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    lng?: number;
}
