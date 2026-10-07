import { Module } from '@nestjs/common';
import { Controller, Post, Body, Inject, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { DbModule, PG_POOL } from '../common/db.module';
import { signToken } from '../common/auth';

class LoginDto {
  role: 'user' | 'therapist' | 'admin';
  account: string;   // 用户/技师用手机号，管理员用用户名
  password: string;
}

@Controller('auth')
class AuthController {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    if (!dto.role || !dto.account || !dto.password) {
      throw new BadRequestException('请选择角色并输入账号密码');
    }
    let row: any;
    if (dto.role === 'admin') {
      const r = await this.db.query(
        'select id, name, username as account, password from admins where username=$1',
        [dto.account],
      );
      row = r.rows[0];
    } else if (dto.role === 'user') {
      const r = await this.db.query(
        'select id, name, phone as account, password from users where phone=$1',
        [dto.account],
      );
      row = r.rows[0];
    } else {
      const r = await this.db.query(
        'select id, name, phone as account, password from therapists where phone=$1',
        [dto.account],
      );
      row = r.rows[0];
    }
    if (!row || row.password !== dto.password) {
      throw new BadRequestException('账号或密码错误');
    }
    const token = signToken({ id: row.id, role: dto.role, name: row.name });
    return {
      token,
      user: { id: row.id, role: dto.role, name: row.name, account: row.account },
    };
  }
}

@Module({ imports: [DbModule], controllers: [AuthController] })
export class AuthModule {}
