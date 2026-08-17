import { IsString, IsOptional, IsArray, IsObject, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
}

export class UpdateBookingDto {
  @ApiPropertyOptional({ description: 'Booking status', enum: BookingStatus, example: BookingStatus.CONFIRMED })
  @IsEnum(BookingStatus)
  @IsOptional()
  status?: BookingStatus;

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

  @ApiPropertyOptional({ description: 'Remark 1', example: 'First remark' })
  @IsString()
  @IsOptional()
  remark1?: string;

  @ApiPropertyOptional({ description: 'Remark 2', example: 'Second remark' })
  @IsString()
  @IsOptional()
  remark2?: string;

  @ApiPropertyOptional({ description: 'Remark 3', example: 'Third remark' })
  @IsString()
  @IsOptional()
  remark3?: string;

  @ApiPropertyOptional({ description: 'Additional metadata', type: 'object' })
  @IsObject()
  @IsOptional()
  metadata?: any;

  [key: string]: any;
}
