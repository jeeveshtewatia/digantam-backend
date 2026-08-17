import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ChannelPartnersService } from './channel-partners.service';
import { CreateChannelPartnerDto } from './dto/create-channel-partner.dto';
import { UpdateChannelPartnerDto } from './dto/update-channel-partner.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { Public } from '../../shared/decorators/public.decorator';
import { UserRole } from '../../config/constants';

@ApiTags('Channel Partners')
@Controller('channel-partners')
export class ChannelPartnersController {
  constructor(private readonly channelPartnersService: ChannelPartnersService) {}

  @Post(':projectId')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new Channel Partner (Admin only)' })
  @ApiResponse({ status: 201, description: 'Channel Partner created successfully' })
  @ApiResponse({ status: 409, description: 'Channel Partner ID already exists' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  async create(
    @Param('projectId') projectId: string,
    @Body() createChannelPartnerDto: CreateChannelPartnerDto,
  ) {
    return this.channelPartnersService.create(projectId, createChannelPartnerDto);
  }

  @Get(':projectId')
  @Public()
  @ApiOperation({ summary: 'Get all Channel Partners for a project (Public)' })
  @ApiResponse({ status: 200, description: 'List of Channel Partners' })
  async findAll(@Param('projectId') projectId: string) {
    return this.channelPartnersService.findAll(projectId);
  }

  @Get(':projectId/:cpId')
  @Public()
  @ApiOperation({ summary: 'Get a single Channel Partner by ID (Public)' })
  @ApiResponse({ status: 200, description: 'Channel Partner details' })
  @ApiResponse({ status: 404, description: 'Channel Partner not found' })
  async findOne(@Param('projectId') projectId: string, @Param('cpId') cpId: string) {
    return this.channelPartnersService.findOne(projectId, cpId);
  }

  @Put(':projectId/:cpId')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a Channel Partner (Admin only)' })
  @ApiResponse({ status: 200, description: 'Channel Partner updated successfully' })
  @ApiResponse({ status: 404, description: 'Channel Partner not found' })
  async update(
    @Param('projectId') projectId: string,
    @Param('cpId') cpId: string,
    @Body() updateChannelPartnerDto: UpdateChannelPartnerDto,
  ) {
    return this.channelPartnersService.update(projectId, cpId, updateChannelPartnerDto);
  }

  @Delete(':projectId/:cpId')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a Channel Partner (Admin only)' })
  @ApiResponse({ status: 200, description: 'Channel Partner deleted successfully' })
  @ApiResponse({ status: 404, description: 'Channel Partner not found' })
  async remove(@Param('projectId') projectId: string, @Param('cpId') cpId: string) {
    return this.channelPartnersService.remove(projectId, cpId);
  }
}
