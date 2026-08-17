import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsEnum } from 'class-validator';
import { CustomerType } from '../../../config/constants';

export class CreateCustomerDto {
  @ApiProperty({ example: 'John', description: 'First name' })
  @IsString()
  firstName: string;

  @ApiPropertyOptional({ example: 'Doe', description: 'Last name' })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({ example: 'john@example.com', description: 'Email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+1234567890', description: 'Phone number' })
  @IsString()
  phone: string;

  @ApiPropertyOptional({ example: '+0987654321', description: 'Alternate phone number' })
  @IsString()
  @IsOptional()
  alt_phone?: string;

  @ApiPropertyOptional({ example: '123 Main St, City', description: 'Address' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: 'unit_001', description: 'Unit ID' })
  @IsString()
  @IsOptional()
  unit_id?: string;

  @ApiPropertyOptional({
    example: CustomerType.ENQUIRY,
    description: 'Customer type',
    enum: CustomerType,
  })
  @IsEnum(CustomerType)
  @IsOptional()
  type?: CustomerType;

  // Allow additional custom fields
  [key: string]: any;
}
