import { ApiProperty } from '@nestjs/swagger';

export class TowerStatDto {
  @ApiProperty({ example: 'A', description: 'Tower name' })
  tower: string;

  @ApiProperty({ example: 21, description: 'Number of unique floors in the tower' })
  floors: number;

  @ApiProperty({ example: 50, description: 'Total number of flats in the tower' })
  totalFlats: number;

  @ApiProperty({
    example: ['2BHK', '3BHK'],
    description: 'Unique unit types available in the tower',
    type: [String],
  })
  unitTypes: string[];

  @ApiProperty({
    example: 1200,
    description: 'Minimum area in sq ft',
    nullable: true,
    required: false,
  })
  minArea: number | null;

  @ApiProperty({
    example: 2500,
    description: 'Maximum area in sq ft',
    nullable: true,
    required: false,
  })
  maxArea: number | null;
}

export class TowerStatsResponseDto {
  @ApiProperty({ example: 'Tower statistics retrieved successfully' })
  message: string;

  @ApiProperty({ example: 3, description: 'Number of towers' })
  count: number;

  @ApiProperty({ type: [TowerStatDto], description: 'Array of tower statistics' })
  towers: TowerStatDto[];
}
