import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateCrmOfficeDto {
    @ApiProperty({ example: 'Main Office' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ example: 72.8777, description: 'Longitude' })
    @IsNumber()
    @Type(() => Number)
    lng: number;

    @ApiProperty({ example: 19.0760, description: 'Latitude' })
    @IsNumber()
    @Type(() => Number)
    lat: number;

    @ApiProperty({ example: 100, description: 'Allowed geo-fence radius in meters' })
    @IsNumber()
    @Min(10)
    @Type(() => Number)
    allowedRadiusMeters: number;

    @ApiPropertyOptional({ example: 'default' })
    @IsString()
    @IsOptional()
    companyId?: string;
}

export class ValidateLocationDto {
    @ApiProperty({ example: 19.0760 })
    @IsNumber()
    @Type(() => Number)
    lat: number;

    @ApiProperty({ example: 72.8777 })
    @IsNumber()
    @Type(() => Number)
    lng: number;

    @ApiPropertyOptional({ example: 'default' })
    @IsString()
    @IsOptional()
    companyId?: string;
}
