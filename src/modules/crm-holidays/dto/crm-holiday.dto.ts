import { IsString, IsNotEmpty, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum HolidayType {
    NATIONAL = 'national',
    OPTIONAL = 'optional',
    COMPANY = 'company',
}

export class CreateCrmHolidayDto {
    @ApiProperty({ example: 'Diwali', description: 'Holiday name' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ example: '2026-10-20', description: 'Holiday date YYYY-MM-DD' })
    @IsDateString()
    date: string;

    @ApiPropertyOptional({ enum: HolidayType, default: HolidayType.COMPANY })
    @IsEnum(HolidayType)
    @IsOptional()
    type?: HolidayType;

    @ApiPropertyOptional({ example: 'default' })
    @IsString()
    @IsOptional()
    companyId?: string;
}
