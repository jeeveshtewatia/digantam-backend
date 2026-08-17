import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { InventoryStatus } from '../../../config/constants';

export class UpdateInventoryDto {
  // Note: 'id' field is intentionally NOT included - it cannot be updated after creation (immutable)
  @ApiPropertyOptional({ example: 'A101', description: 'Unit number' })
  @IsString()
  @IsOptional()
  unit_number?: string;

  @ApiPropertyOptional({ example: '2BHK', description: 'Unit type' })
  @IsString()
  @IsOptional()
  unit_type?: string;

  @ApiPropertyOptional({ example: 'Tower A', description: 'Tower name' })
  @IsString()
  @IsOptional()
  tower?: string;

  @ApiPropertyOptional({ example: '10', description: 'Floor number' })
  @IsString()
  @IsOptional()
  floor?: string;

  @ApiPropertyOptional({ example: 1200, description: 'Area in sq ft' })
  @IsNumber()
  @IsOptional()
  area?: number;

  @ApiPropertyOptional({ example: 'North', description: 'Direction/Facing' })
  @IsString()
  @IsOptional()
  direction?: string;

  @ApiPropertyOptional({ example: 5000000, description: 'Total cost' })
  @IsNumber()
  @IsOptional()
  total_cost?: number;

  @ApiPropertyOptional({
    example: InventoryStatus.AVAILABLE,
    description: 'Inventory status',
    enum: InventoryStatus,
  })
  @IsEnum(InventoryStatus)
  @IsOptional()
  status?: InventoryStatus;

  @ApiPropertyOptional({ example: 'Prime location', description: 'Remarks' })
  @IsString()
  @IsOptional()
  remarks?: string;

  // Allow additional custom fields
  [key: string]: any;
}
