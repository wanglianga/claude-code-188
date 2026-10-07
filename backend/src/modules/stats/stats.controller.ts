import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/roles.decorator';
import { UserRole } from '../../entities';
import { StatsService } from './stats.service';

@ApiTags('统计看板')
@Controller('stats')
@Roles(UserRole.ADMIN)
export class StatsController {
  constructor(private stats: StatsService) {}

  @Get('overview')
  @ApiOperation({ summary: '总览' })
  overview() {
    return this.stats.overview();
  }

  @Get('by-therapist')
  @ApiOperation({ summary: '按技师统计（异常率/退款/疼痛改善）' })
  byTherapist() {
    return this.stats.byTherapist();
  }

  @Get('by-service-type')
  @ApiOperation({ summary: '按服务类目统计' })
  byServiceType() {
    return this.stats.byServiceType();
  }

  @Get('exceptions-by-type')
  @ApiOperation({ summary: '按异常类型统计' })
  exceptionsByType() {
    return this.stats.exceptionsByType();
  }
}
