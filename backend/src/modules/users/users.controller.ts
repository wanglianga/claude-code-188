import { Body, Controller, Get, Param, Patch, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/current-user.decorator';
import { Roles } from '../../common/roles.decorator';
import { UserRole } from '../../entities';
import { UpsertHealthProfileDto, UpsertTherapistProfileDto } from './dto';
import { UsersService } from './users.service';

@ApiTags('用户与档案')
@Controller()
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('health-profiles/me')
  @ApiOperation({ summary: '我的健康档案' })
  myProfile(@CurrentUser() u: AuthUser) {
    return this.users.getMyHealthProfile(u.id);
  }

  @Put('health-profiles/me')
  @ApiOperation({ summary: '更新我的健康档案' })
  upsertProfile(@CurrentUser() u: AuthUser, @Body() dto: UpsertHealthProfileDto) {
    return this.users.upsertMyHealthProfile(u.id, dto);
  }

  @Get('therapist-profiles/me')
  @Roles(UserRole.THERAPIST)
  @ApiOperation({ summary: '我的技师档案' })
  myTherapistProfile(@CurrentUser() u: AuthUser) {
    return this.users.getMyTherapistProfile(u.id);
  }

  @Put('therapist-profiles/me')
  @Roles(UserRole.THERAPIST)
  @ApiOperation({ summary: '更新我的技师档案' })
  upsertTherapistProfile(@CurrentUser() u: AuthUser, @Body() dto: UpsertTherapistProfileDto) {
    return this.users.upsertMyTherapistProfile(u.id, dto);
  }

  @Get('users')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '账号列表（管理端）' })
  listUsers(@Query('role') role?: UserRole) {
    return this.users.listUsers(role);
  }

  @Get('therapists')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '技师列表（派单用）' })
  listTherapists() {
    return this.users.listTherapists();
  }

  @Patch('users/:id/active')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '启用/停用账号' })
  setActive(@Param('id') id: string, @Body('active') active: boolean) {
    return this.users.setActive(id, !!active);
  }
}
