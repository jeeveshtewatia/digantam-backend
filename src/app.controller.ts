import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './shared/decorators/public.decorator';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({ status: 200, description: 'API is running' })
  getHealth() {
    return this.appService.getHealth();
  }

  @Public()
  @Get('info')
  @ApiOperation({ summary: 'Get API information' })
  @ApiResponse({ status: 200, description: 'API information' })
  getInfo() {
    return this.appService.getInfo();
  }
}
