import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsObject, IsBoolean, IsArray, IsUrl } from 'class-validator';
import { ProjectType } from '../../../config/constants';

export class UpdateProjectDto {
  @ApiPropertyOptional({ example: 'My Updated Project', description: 'Project name' })
  @IsString()
  @IsOptional()
  projectName?: string;

  @ApiPropertyOptional({ example: ProjectType.INVENTORY, description: 'Project type', enum: ProjectType })
  @IsEnum(ProjectType)
  @IsOptional()
  projectType?: ProjectType;

  @ApiPropertyOptional({ example: 'Updated description', description: 'Project description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    example: 'https://luxury-towers.sketchers3d.com',
    description: 'Production/frontend URL of the project. Admin can access project directly from dashboard.',
  })
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }, { message: 'Frontend URL must be a valid HTTP/HTTPS URL' })
  @IsOptional()
  frontendUrl?: string;

  @ApiPropertyOptional({ description: 'Custom inventory schema definition' })
  @IsObject()
  @IsOptional()
  inventorySchema?: any;

  @ApiPropertyOptional({ description: 'Custom customer schema definition' })
  @IsObject()
  @IsOptional()
  customerSchema?: any;

  @ApiPropertyOptional({ example: true, description: 'Whether the project requires authentication' })
  @IsBoolean()
  @IsOptional()
  requires_auth?: boolean;

  @ApiPropertyOptional({ example: ['admin', 'rm'], description: 'Allowed roles for the project' })
  @IsArray()
  @IsOptional()
  allowed_roles?: string[];

  @ApiPropertyOptional({ description: 'Additional project settings' })
  @IsObject()
  @IsOptional()
  settings?: any;

  @ApiPropertyOptional({ example: true, description: 'Project active status' })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
