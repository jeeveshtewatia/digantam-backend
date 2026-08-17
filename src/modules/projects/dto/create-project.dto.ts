import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsObject, IsBoolean, IsArray, IsUrl } from 'class-validator';
import { ProjectType } from '../../../config/constants';

export class CreateProjectDto {
  @ApiProperty({ example: 'project_001', description: 'Unique project identifier' })
  @IsString()
  projectId: string;

  @ApiProperty({ example: 'My First Project', description: 'Project name' })
  @IsString()
  projectName: string;

  @ApiProperty({ example: ProjectType.INVENTORY, description: 'Project type', enum: ProjectType })
  @IsEnum(ProjectType)
  projectType: ProjectType;

  @ApiPropertyOptional({ example: 'A comprehensive inventory management system', description: 'Project description' })
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

  @ApiPropertyOptional({
    example: {
      unit_number: { type: 'String', required: true },
      area: { type: 'Number', required: false },
    },
    description: 'Custom inventory schema definition',
  })
  @IsObject()
  @IsOptional()
  inventorySchema?: any;

  @ApiPropertyOptional({
    example: {
      firstName: { type: 'String', required: true },
      email: { type: 'String', required: true },
    },
    description: 'Custom customer schema definition',
  })
  @IsObject()
  @IsOptional()
  customerSchema?: any;

  @ApiPropertyOptional({ example: true, description: 'Whether the project requires authentication' })
  @IsBoolean()
  @IsOptional()
  requires_auth?: boolean;

  @ApiPropertyOptional({ example: ['admin', 'rm', 'user'], description: 'Allowed roles for the project' })
  @IsArray()
  @IsOptional()
  allowed_roles?: string[];

  @ApiPropertyOptional({ example: {}, description: 'Additional project settings' })
  @IsObject()
  @IsOptional()
  settings?: any;
}
