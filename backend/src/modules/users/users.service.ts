import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HealthProfile, TherapistProfile, User, UserRole } from '../../entities';
import { UpsertHealthProfileDto, UpsertTherapistProfileDto } from './dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(HealthProfile) private profiles: Repository<HealthProfile>,
    @InjectRepository(TherapistProfile) private therapistProfiles: Repository<TherapistProfile>,
  ) {}

  async getMyHealthProfile(userId: string) {
    let p = await this.profiles.findOne({ where: { userId } });
    if (!p) p = await this.profiles.save(this.profiles.create({ userId }));
    return p;
  }

  async upsertMyHealthProfile(userId: string, dto: UpsertHealthProfileDto) {
    const p = await this.getMyHealthProfile(userId);
    Object.assign(p, dto);
    return this.profiles.save(p);
  }

  async getMyTherapistProfile(userId: string) {
    let p = await this.therapistProfiles.findOne({ where: { userId } });
    if (!p) p = await this.therapistProfiles.save(this.therapistProfiles.create({ userId }));
    return p;
  }

  async upsertMyTherapistProfile(userId: string, dto: UpsertTherapistProfileDto) {
    const p = await this.getMyTherapistProfile(userId);
    Object.assign(p, dto);
    return this.therapistProfiles.save(p);
  }

  /** 管理端：全部账号 */
  async listUsers(role?: UserRole) {
    const where = role ? { role } : {};
    const users = await this.users.find({ where, order: { createdAt: 'DESC' } });
    return users.map((u) => ({
      id: u.id,
      phone: u.phone,
      name: u.name,
      role: u.role,
      active: u.active,
      createdAt: u.createdAt,
    }));
  }

  /** 技师列表（含档案，供派单选择） */
  async listTherapists() {
    const therapists = await this.users.find({ where: { role: UserRole.THERAPIST, active: true } });
    const profiles = await this.therapistProfiles.find();
    const map = new Map(profiles.map((p) => [p.userId, p]));
    return therapists.map((t) => ({
      id: t.id,
      name: t.name,
      phone: t.phone,
      profile: map.get(t.id) || null,
    }));
  }

  async setActive(id: string, active: boolean) {
    const u = await this.users.findOne({ where: { id } });
    if (!u) throw new NotFoundException('用户不存在');
    u.active = active;
    return this.users.save(u);
  }
}
