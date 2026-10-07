import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/current-user.decorator';
import { Roles } from '../../common/roles.decorator';
import { RecordStatus, UserRole } from '../../entities';
import {
  AddItemsDto,
  CheckinDto,
  CreateRecordDto,
  DispatchDto,
  FollowUpDto,
  ReferralDto,
  RespondDto,
  UpdateVisitDto,
} from './dto';
import { RecordsService } from './records.service';

@ApiTags('健康服务记录')
@Controller('records')
export class RecordsController {
  constructor(private records: RecordsService) {}

  @Post()
  @Roles(UserRole.USER)
  @ApiOperation({ summary: '用户预约上门理疗（自动生成风险评估）' })
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateRecordDto) {
    return this.records.create(u.id, dto);
  }

  @Get('my')
  @Roles(UserRole.USER)
  @ApiOperation({ summary: '我的服务记录' })
  my(@CurrentUser() u: AuthUser) {
    return this.records.myRecords(u.id);
  }

  @Get('my-courses')
  @Roles(UserRole.USER)
  @ApiOperation({ summary: '我的疗程' })
  myCourses(@CurrentUser() u: AuthUser) {
    return this.records.myCourses(u.id);
  }

  @Get('queue')
  @Roles(UserRole.THERAPIST)
  @ApiOperation({ summary: '技师待接订单（含风险评估/所需器械）' })
  queue(@CurrentUser() u: AuthUser) {
    return this.records.therapistQueue(u.id);
  }

  @Get('my-orders')
  @Roles(UserRole.THERAPIST)
  @ApiOperation({ summary: '技师已接订单' })
  myOrders(@CurrentUser() u: AuthUser) {
    return this.records.therapistOrders(u.id);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '全部记录（管理端，可过滤）' })
  list(
    @Query('status') status?: RecordStatus,
    @Query('therapistId') therapistId?: string,
    @Query('category') category?: string,
    @Query('hasException') hasException?: string,
  ) {
    return this.records.listAll({ status, therapistId, category, hasException });
  }

  @Get(':id')
  @ApiOperation({ summary: '记录详情（评估/派单/上门/异常/随访/结算/转诊聚合）' })
  detail(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    return this.records.detail(id, u);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: '取消预约' })
  cancel(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    return this.records.cancel(id, u);
  }

  @Post(':id/dispatch')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '派单（管理端）' })
  dispatch(@Param('id') id: string, @CurrentUser() u: AuthUser, @Body() dto: DispatchDto) {
    return this.records.dispatch(id, u.id, dto.therapistId, dto.note);
  }

  @Post(':id/respond')
  @Roles(UserRole.THERAPIST)
  @ApiOperation({ summary: '技师接单/拒单' })
  respond(@Param('id') id: string, @CurrentUser() u: AuthUser, @Body() dto: RespondDto) {
    return this.records.respond(id, u.id, dto.accept, dto.reason);
  }

  @Post(':id/checkin')
  @Roles(UserRole.THERAPIST)
  @ApiOperation({ summary: '到场签到（迟到自动生成异常）' })
  checkin(@Param('id') id: string, @CurrentUser() u: AuthUser, @Body() dto: CheckinDto) {
    return this.records.checkin(id, u.id, dto);
  }

  @Put(':id/visit')
  @Roles(UserRole.THERAPIST)
  @ApiOperation({ summary: '填写本次服务记录（疼痛评分/生命体征/手法强度等）' })
  updateVisit(@Param('id') id: string, @CurrentUser() u: AuthUser, @Body() dto: UpdateVisitDto) {
    return this.records.updateVisit(id, u.id, dto);
  }

  @Post(':id/items')
  @Roles(UserRole.THERAPIST)
  @ApiOperation({ summary: '服务中临时加项' })
  addItems(@Param('id') id: string, @CurrentUser() u: AuthUser, @Body() dto: AddItemsDto) {
    return this.records.addItems(id, u.id, dto);
  }

  @Post(':id/complete-visit')
  @Roles(UserRole.THERAPIST)
  @ApiOperation({ summary: '完成本次服务（生成结算单）' })
  completeVisit(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    return this.records.completeVisit(id, u.id);
  }

  @Post(':id/follow-ups')
  @Roles(UserRole.THERAPIST, UserRole.ADMIN)
  @ApiOperation({ summary: '登记随访' })
  addFollowUp(@Param('id') id: string, @CurrentUser() u: AuthUser, @Body() dto: FollowUpDto) {
    return this.records.addFollowUp(id, u, dto);
  }

  @Post(':id/referrals')
  @Roles(UserRole.THERAPIST, UserRole.ADMIN)
  @ApiOperation({ summary: '登记转诊/复诊建议' })
  addReferral(@Param('id') id: string, @CurrentUser() u: AuthUser, @Body() dto: ReferralDto) {
    return this.records.addReferral(id, u, dto);
  }
}
