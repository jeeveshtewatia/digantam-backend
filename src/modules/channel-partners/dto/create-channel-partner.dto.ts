import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsObject, IsEnum } from 'class-validator';

export class CreateChannelPartnerDto {
  @ApiPropertyOptional({ example: 'CP001', description: 'Unique identifier (auto-generated if not provided)' })
  @IsString()
  @IsOptional()
  id?: string;

  @ApiProperty({ example: 'John Doe', description: 'Name of the Channel Partner' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'john@example.com', description: 'Email address' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '+919876543210', description: 'Phone number' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'ABC Real Estate', description: 'Firm name' })
  @IsString()
  @IsOptional()
  firm_name?: string;

  @ApiPropertyOptional({ example: 'active', description: 'Status of the Channel Partner', enum: ['active', 'inactive'] })
  @IsEnum(['active', 'inactive'])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ example: {}, description: 'Additional metadata' })
  @IsObject()
  @IsOptional()
  metadata?: any;
}
