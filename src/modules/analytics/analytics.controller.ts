import { Controller, Get, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { ProjectValidationGuard } from '../../shared/guards/project-validation.guard';
import { ProjectAuthGuard } from '../../shared/guards/project-auth.guard';
import { ProjectId } from '../../shared/decorators/project-id.decorator';

@ApiTags('Analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard, ProjectValidationGuard, ProjectAuthGuard)
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get(':projectId/summary')
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String })
  @ApiOperation({ summary: 'Get dashboard summary statistics' })
  @ApiResponse({ status: 200, description: 'Summary statistics retrieved successfully' })
  async getSummary(@ProjectId() projectId: string) {
    return this.analyticsService.getDashboardSummary(projectId);
  }

  @Get(':projectId/inventory-status')
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String })
  @ApiOperation({ summary: 'Get inventory status breakdown' })
  async getInventoryStatus(@ProjectId() projectId: string) {
    return this.analyticsService.getInventoryStatusBreakdown(projectId);
  }

  @Get(':projectId/recent-activity')
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String })
  @ApiOperation({ summary: 'Get recent activity logs' })
  async getRecentActivity(@ProjectId() projectId: string) {
    return this.analyticsService.getRecentActivity(projectId);
  }
}
