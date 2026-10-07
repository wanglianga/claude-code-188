import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { HealthProfile, TherapistProfile, User, UserRole } from '../../entities';
import { LoginDto, RegisterDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(HealthProfile) private profiles: Repository<HealthProfile>,
    @InjectRepository(TherapistProfile) private therapistProfiles: Repository<TherapistProfile>,
    private jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.users.findOne({ where: { phone: dto.phone } });
    if (exists) throw new BadRequestException('该手机号已注册');
    const user = this.users.create({
      phone: dto.phone,
      name: dto.name,
      passwordHash: await bcrypt.hash(dto.password, 10),
      role: dto.role === 'THERAPIST' ? UserRole.THERAPIST : UserRole.USER,
    });
    await this.users.save(user);
    if (user.role === UserRole.USER) {
      await this.profiles.save(this.profiles.create({ userId: user.id }));
    } else {
      await this.therapistProfiles.save(
        this.therapistProfiles.create({ userId: user.id, skills: [], equipment: [] }),
      );
    }
    return this.issueToken(user);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findOne({ where: { phone: dto.phone } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('手机号或密码错误');
    }
    if (!user.active) throw new UnauthorizedException('账号已被停用');
    return this.issueToken(user);
  }

  private issueToken(user: User) {
    const token = this.jwt.sign({
      sub: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role,
    });
    return {
      token,
      user: { id: user.id, phone: user.phone, name: user.name, role: user.role },
    };
  }
}
