import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/current-user.decorator';
import { Roles } from '../../common/roles.decorator';
import { SettlementStatus, UserRole } from '../../entities';
import { PayDto, RefundHandleDto, RefundRequestDto } from './dto';
import { SettlementsService } from './settlements.service';

@ApiTags('结算')
@Controller()
export class SettlementsController {
  constructor(private settlements: SettlementsService) {}

  @Post('records/:recordId/settlement/pay')
  @ApiOperation({ summary: '发起结算（医保/社区补贴/自费，可模拟通道失败）' })
  pay(@Param('recordId') recordId: string, @CurrentUser() u: AuthUser, @Body() dto: PayDto) {
    return this.settlements.pay(recordId, u, dto);
  }

  @Post('records/:recordId/settlement/refund-request')
  @Roles(UserRole.USER)
  @ApiOperation({ summary: '用户申请退款' })
  requestRefund(
    @Param('recordId') recordId: string,
    @CurrentUser() u: AuthUser,
    @Body() dto: RefundRequestDto,
  ) {
    return this.settlements.requestRefund(recordId, u, dto);
  }

  @Post('settlements/:id/refund')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '审批退款（管理端）' })
  handleRefund(@Param('id') id: string, @CurrentUser() u: AuthUser, @Body() dto: RefundHandleDto) {
    return this.settlements.handleRefund(id, u.id, dto);
  }

  @Get('settlements')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '结算单列表（管理端）' })
  list(@Query('status') status?: SettlementStatus) {
    return this.settlements.list(status);
  }
}
