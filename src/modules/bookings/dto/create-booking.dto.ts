import { IsString, IsNotEmpty, IsOptional, IsArray, IsObject, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBookingDto {
  @ApiProperty({ description: 'Unit ID to book', example: 'unit_001' })
  @IsString()
  @IsNotEmpty()
  unit_id: string;

  @ApiProperty({ description: 'Project ID', example: 'project_001' })
  @IsString()
  @IsNotEmpty()
  project_id: string;

  @ApiPropertyOptional({ description: 'Customer ID (if existing customer)', example: 'customer_123' })
  @IsString()
  @IsOptional()
  customer_id?: string;

  @ApiPropertyOptional({ description: 'RM name', example: 'John Doe' })
  @IsString()
  @IsOptional()
  rm_name?: string;

  @ApiPropertyOptional({ description: 'RM ID', example: 'rm_001' })
  @IsString()
  @IsOptional()
  rm_id?: string;

  @ApiPropertyOptional({ description: 'Reference or cheque number', example: 'CHQ123456' })
  @IsString()
  @IsOptional()
  ref_or_cheque?: string;

  @ApiPropertyOptional({ description: 'Document URLs', type: [String] })
  @IsArray()
  @IsOptional()
  documents?: string[];

  @ApiPropertyOptional({ description: 'Aadhar URLs', type: [String] })
  @IsArray()
  @IsOptional()
  aadhar?: string[];

  @ApiPropertyOptional({ description: 'PAN card URLs', type: [String] })
  @IsArray()
  @IsOptional()
  pancard?: string[];

  @ApiPropertyOptional({ description: 'Cheque picture URLs', type: [String] })
  @IsArray()
  @IsOptional()
  cheque_pic?: string[];

  @ApiPropertyOptional({ description: 'Cheque amount', example: '100000' })
  @IsString()
  @IsOptional()
  cheque_amount?: string;

  @ApiPropertyOptional({ description: 'Partner details', example: 'Partner info' })
  @IsString()
  @IsOptional()
  partner_details?: string;

  @ApiPropertyOptional({ description: 'KYC information', type: 'object' })
  @IsObject()
  @IsOptional()
  kyc?: any;

  @ApiPropertyOptional({ description: 'TCB information', example: 'TCB details' })
  @IsString()
  @IsOptional()
  tcb?: string;

  @ApiPropertyOptional({ description: 'Additional metadata', type: 'object' })
  @IsObject()
  @IsOptional()
  metadata?: any;

  // Customer details for new booking with customer creation
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

  @ApiPropertyOptional({ description: 'Customer type', example: 'buyer' })
  @IsString()
  @IsOptional()
  type?: string;

  // Additional customer fields (flexible for different projects)
  [key: string]: any;
}
