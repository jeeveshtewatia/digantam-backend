import { Controller, Post, Get, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Public } from '../../shared/decorators/public.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async register(@Body() registerDto: RegisterDto, @CurrentUser() currentUser: any) {
    return this.authService.register(registerDto,currentUser);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@CurrentUser('_id') userId: string) {
    return this.authService.getProfile(userId);
  }

  @Put('users/:userId/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'userId', description: 'User ID to update', type: String })
  @ApiOperation({
    summary: 'Update user active status',
    description:
      'Super admin can activate/deactivate admin or RM users. Admin can activate/deactivate RM users of their own project only.',
  })
  @ApiResponse({ status: 200, description: 'User status updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUserStatus(
    @Param('userId') userId: string,
    @Body() updateStatusDto: UpdateUserStatusDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.authService.updateUserStatus(userId, updateStatusDto, currentUser);
  }

  @Get('projects/:projectId/users/stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String, example: 'project_001' })
  @ApiOperation({
    summary: 'Get project users statistics (counts only)',
    description:
      'Returns counts of Admin and RM users for the specified project. Use this for dashboard overview. Super admin can view any project. Admin can only view their own project.',
  })
  @ApiResponse({
    status: 200,
    description: 'Project users statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        project_id: { type: 'string' },
        total: {
          type: 'object',
          properties: {
            count: { type: 'number' },
            active: { type: 'number' },
            inactive: { type: 'number' },
          },
        },
        admins: {
          type: 'object',
          properties: {
            count: { type: 'number' },
            active: { type: 'number' },
            inactive: { type: 'number' },
          },
        },
        rms: {
          type: 'object',
          properties: {
            count: { type: 'number' },
            active: { type: 'number' },
            inactive: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async getProjectUsersStats(
    @Param('projectId') projectId: string,
    @CurrentUser() currentUser: any,
  ) {
    return this.authService.getProjectUsersStats(projectId, currentUser);
  }

  @Get('projects/:projectId/users')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String, example: 'project_001' })
  @ApiQuery({
    name: 'role',
    required: false,
    type: String,
    enum: ['admin', 'rm', 'admin,rm'],
    description: 'Filter by role (admin, rm, or both). Default: both',
  })
  @ApiOperation({
    summary: 'Get Admin and RM users details for a project',
    description:
      'Returns detailed list of Admin and RM users for the specified project. Call this after viewing stats when user wants to see details. Super admin can view any project. Admin can only view their own project users.',
  })
  @ApiResponse({
    status: 200,
    description: 'Project users retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        project_id: { type: 'string' },
        total: { type: 'number' },
        admins: { type: 'number' },
        rms: { type: 'number' },
        users: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              _id: { type: 'string' },
              email: { type: 'string' },
              firstName: { type: 'string' },
              lastName: { type: 'string' },
              phone: { type: 'string' },
              role: { type: 'string' },
              project_id: { type: 'string' },
              is_active: { type: 'boolean' },
              createdAt: { type: 'string' },
              updatedAt: { type: 'string' },
            },
          },
        },
        grouped: {
          type: 'object',
          properties: {
            admins: { type: 'array' },
            rms: { type: 'array' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async getProjectUsers(
    @Param('projectId') projectId: string,
    @Query('role') role?: string,
    @CurrentUser() currentUser?: any,
  ) {
    return this.authService.getProjectUsers(projectId, currentUser, role);
  }
}
