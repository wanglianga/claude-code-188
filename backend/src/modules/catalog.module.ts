import { Module } from '@nestjs/common';
import { Controller, Get, Query, Inject, UseGuards } from '@nestjs/common';
import { Pool } from 'pg';
import { DbModule, PG_POOL } from '../common/db.module';
import { AuthGuard, Roles, RolesGuard, CurrentUser, AuthUser } from '../common/auth';

@Controller('catalog')
@UseGuards(AuthGuard, RolesGuard)
class CatalogController {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  /** 服务类型（含常规所需器械 + 实时器械可用性） */
  @Get('service-types')
  async serviceTypes() {
    const types = (await this.db.query(`select * from service_types order by id`)).rows;
    const equip = (await this.db.query(`select name, status from equipment`)).rows;
    const equipMap = new Map(equip.map((e: any) => [e.name, e.status]));
    return types.map((t: any) => ({
      ...t,
      equipment_status: (t.required_equipment || []).map((name: string) => ({
        name,
        status: equipMap.get(name) || 'unregistered',
      })),
    }));
  }

  /** 器械台账（技师/管理端） */
  @Get('equipment')
  @Roles('therapist', 'admin')
  equipment() {
    return this.db.query(`select * from equipment order by id`).then((r) => r.rows);
  }

  /** 技师擅长（管理端派单参考） */
  @Get('therapists')
  @Roles('admin')
  therapists() {
    return this.db.query(
      `select t.*,
              (select coalesce(json_agg(st.id), '[]') from therapist_skills sk
                 join service_types st on st.id = sk.service_type_id
                where sk.therapist_id = t.id) as skill_ids
         from therapists t order by t.id`,
    ).then((r) => r.rows);
  }

  /** 我的疗程包（用户端） */
  @Get('courses')
  @Roles('user')
  myCourses(@CurrentUser() u: AuthUser) {
    return this.db.query(
      `select c.*, st.name as service_type_name, st.category
         from courses c join service_types st on st.id = c.service_type_id
        where c.user_id = $1 order by c.id desc`,
      [u.id],
    ).then((r) => r.rows);
  }
}

@Module({ imports: [DbModule], controllers: [CatalogController] })
export class CatalogModule {}
