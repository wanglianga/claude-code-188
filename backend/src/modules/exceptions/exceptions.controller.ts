import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/current-user.decorator';
import { Roles } from '../../common/roles.decorator';
import { ExceptionStatus, UserRole } from '../../entities';
import { CreateExceptionDto, HandleExceptionDto } from './dto';
import { ExceptionsService } from './exceptions.service';

@ApiTags('异常事件')
@Controller()
export class ExceptionsController {
  constructor(private exceptions: ExceptionsService) {}

  @Post('records/:recordId/exceptions')
  @ApiOperation({ summary: '上报异常（用户/技师/管理员）' })
  create(
    @Param('recordId') recordId: string,
    @CurrentUser() u: AuthUser,
    @Body() dto: CreateExceptionDto,
  ) {
    return this.exceptions.create(recordId, u, dto);
  }

  @Get('exceptions')
  @ApiOperation({ summary: '异常列表（按角色过滤）' })
  list(
    @CurrentUser() u: AuthUser,
    @Query('status') status?: ExceptionStatus,
    @Query('type') type?: string,
    @Query('recordId') recordId?: string,
  ) {
    return this.exceptions.list(u, { status, type, recordId });
  }

  @Post('exceptions/:id/handle')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '处理异常（管理端）' })
  handle(@Param('id') id: string, @CurrentUser() u: AuthUser, @Body() dto: HandleExceptionDto) {
    return this.exceptions.handle(id, u.id, dto);
  }
}
