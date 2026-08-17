import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateUserStatusDto {
  @ApiProperty({ example: true, description: 'User active status' })
  @IsBoolean()
  is_active: boolean;
}
