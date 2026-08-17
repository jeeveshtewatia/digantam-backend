import { IsString, IsNotEmpty, IsOptional, IsMongoId } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCrmDepartmentDto {
    @ApiProperty({ example: 'Engineering' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiPropertyOptional({ example: 'Software development team' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiPropertyOptional({ example: '65abc123...' })
    @IsMongoId()
    @IsOptional()
    managerId?: string;
}

export class UpdateCrmDepartmentDto {
    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    name?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    description?: string;

    @ApiPropertyOptional()
    @IsMongoId()
    @IsOptional()
    managerId?: string;
}
