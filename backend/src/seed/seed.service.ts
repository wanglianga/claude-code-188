import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import {
  HealthProfile,
  ServiceCategory,
  ServiceItem,
  SettlementChannel,
  TherapistProfile,
  User,
  UserRole,
} from '../entities';
import { RecordsService } from '../modules/records/records.service';
import { SettlementsService } from '../modules/settlements/settlements.service';

/** 首次启动写入测试账号、服务目录与演示业务数据 */
@Injectable()
export class SeedService {
  private logger = new Logger('Seed');

  constructor(
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(HealthProfile) private profiles: Repository<HealthProfile>,
    @InjectRepository(TherapistProfile) private therapistProfiles: Repository<TherapistProfile>,
    @InjectRepository(ServiceItem) private items: Repository<ServiceItem>,
    private recordsService: RecordsService,
    private settlementsService: SettlementsService,
  ) {}

  async onApplicationBootstrap() {
    if (process.env.SEED_ON_BOOT === 'false') return;
    const count = await this.users.count();
    if (count > 0) return;
    this.logger.log('数据库为空，写入种子数据...');
    await this.seed();
    this.logger.log('种子数据完成');
  }

  private async seed() {
    const pwd = (p: string) => bcrypt.hashSync(p, 10);
    const mkUser = async (phone: string, password: string, name: string, role: UserRole) =>
      this.users.save(this.users.create({ phone, passwordHash: pwd(password), name, role }));

    // ---- 账号 ----
    const admin = await mkUser('13800000001', 'admin123', '平台管理员', UserRole.ADMIN);
    const t1 = await mkUser('13800000002', '123456', '王康复', UserRole.THERAPIST);
    const t2 = await mkUser('13800000003', '123456', '李理疗', UserRole.THERAPIST);
    const t3 = await mkUser('13800000004', '123456', '赵产后', UserRole.THERAPIST);
    const u1 = await mkUser('13800000010', '123456', '张阿姨', UserRole.USER);
    const u2 = await mkUser('13800000011', '123456', '刘先生', UserRole.USER);
    const u3 = await mkUser('13800000012', '123456', '陈女士', UserRole.USER);

    await this.therapistProfiles.save([
      this.therapistProfiles.create({
        userId: t1.id, title: '资深康复师', yearsExp: 12, serviceArea: '城东片区',
        skills: ['POST_SURGERY', 'PAIN'],
        equipment: ['便携按摩床', '中频治疗仪', '弹力带', '角度尺', '一次性床单', '握力器'],
        bio: '擅长术后康复与颈肩腰腿痛物理治疗',
      }),
      this.therapistProfiles.create({
        userId: t2.id, title: '理疗师', yearsExp: 8, serviceArea: '城西片区',
        skills: ['PAIN', 'ELDERLY'],
        equipment: ['便携按摩床', '热敷包', '平衡垫', '助行器', '弹力带'],
        bio: '擅长老年关节训练与慢性疼痛理疗',
      }),
      this.therapistProfiles.create({
        userId: t3.id, title: '产后康复师', yearsExp: 6, serviceArea: '城中片区',
        skills: ['POSTPARTUM'],
        equipment: ['一次性床单', '生物反馈仪', '便携按摩床'],
        bio: '专注产后盆底与腹直肌修复',
      }),
    ]);

    await this.profiles.save([
      this.profiles.create({
        userId: u1.id, gender: '女', age: 68,
        medicalHistory: '高血压病史10年，规律服药；2023年左膝关节置换术后',
        medications: '苯磺酸氨氯地平 5mg qd',
        contraindications: '血压未控制时避免剧烈手法',
        contraindicationTags: ['高血压未控制'],
        imagingReports: '2024-03 膝关节X线：置换术后改变',
        insuranceNo: 'YB330100001', hasSubsidy: true,
      }),
      this.profiles.create({
        userId: u2.id, gender: '男', age: 35,
        medicalHistory: '右膝前交叉韧带重建术后6周',
        medications: '无',
        contraindications: '术后早期避免过度屈伸',
        contraindicationTags: [],
        imagingReports: '2024-08 MRI：ACL重建术后改变',
        insuranceNo: 'YB330100002', hasSubsidy: false,
      }),
      this.profiles.create({
        userId: u3.id, gender: '女', age: 30,
        medicalHistory: '顺产产后3个月',
        medications: '无',
        contraindications: '无',
        contraindicationTags: [],
        imagingReports: '产后42天复查未见明显异常',
        insuranceNo: null, hasSubsidy: false,
      }),
    ]);

    // ---- 服务项目目录 ----
    const itemData: Partial<ServiceItem>[] = [
      { code: 'PAIN-01', name: '颈肩推拿放松', category: ServiceCategory.PAIN, price: 168, durationMin: 45, baseRisk: 1, requiredEquipment: ['便携按摩床', '一次性床单'], contraindicationTags: ['急性损伤期', '皮肤破损/感染'], description: '针对颈肩肌肉紧张、劳损的推拿放松' },
      { code: 'PAIN-02', name: '腰腿痛物理因子治疗', category: ServiceCategory.PAIN, price: 198, durationMin: 60, baseRisk: 2, requiredEquipment: ['中频治疗仪', '热敷包'], contraindicationTags: ['心脏病/起搏器', '皮肤破损/感染', '恶性肿瘤'], description: '中频电疗联合热敷缓解腰腿疼痛' },
      { code: 'SURG-01', name: '术后关节活动度训练', category: ServiceCategory.POST_SURGERY, price: 268, durationMin: 60, baseRisk: 2, requiredEquipment: ['便携按摩床', '弹力带', '角度尺'], contraindicationTags: ['急性损伤期', '发热/急性感染', '深静脉血栓'], description: '术后关节活动度评估与渐进训练' },
      { code: 'SURG-02', name: '术后肌力恢复训练', category: ServiceCategory.POST_SURGERY, price: 228, durationMin: 45, baseRisk: 2, requiredEquipment: ['弹力带', '握力器'], contraindicationTags: ['发热/急性感染'], description: '术后肌力分级评估与恢复训练' },
      { code: 'POST-01', name: '产后盆底肌修复指导', category: ServiceCategory.POSTPARTUM, price: 238, durationMin: 50, baseRisk: 1, requiredEquipment: ['一次性床单', '生物反馈仪'], contraindicationTags: ['皮肤破损/感染', '发热/急性感染'], description: '盆底肌评估与居家训练指导' },
      { code: 'POST-02', name: '产后腹直肌分离修复', category: ServiceCategory.POSTPARTUM, price: 218, durationMin: 45, baseRisk: 1, requiredEquipment: ['便携按摩床', '一次性床单'], contraindicationTags: [], description: '腹直肌分离评估、手法与训练' },
      { code: 'ELD-01', name: '老年膝关节功能训练', category: ServiceCategory.ELDERLY, price: 188, durationMin: 50, baseRisk: 2, requiredEquipment: ['弹力带', '助行器'], contraindicationTags: ['骨质疏松', '急性损伤期'], description: '膝关节周围肌力与活动度训练' },
      { code: 'ELD-02', name: '老年人平衡防跌倒训练', category: ServiceCategory.ELDERLY, price: 168, durationMin: 45, baseRisk: 1, requiredEquipment: ['平衡垫', '助行器'], contraindicationTags: [], description: '平衡能力评估与防跌倒训练' },
    ];
    const savedItems = await this.items.save(itemData.map((d) => this.items.create(d)));
    const byCode = (code: string) => savedItems.find((i) => i.code === code);

    // ---- 演示业务数据（完整走通业务流程） ----
    const inDays = (d: number) => new Date(Date.now() + d * 86400_000).toISOString();

    // 演示1：张阿姨 老年膝关节训练 → 李理疗，医保结算成功 + 随访
    const r1 = await this.recordsService.create(u1.id, {
      serviceItemIds: [byCode('ELD-01').id],
      painParts: ['左膝'], painScoreInitial: 6,
      address: '阳光社区 3 栋 2 单元 501', floor: 5, hasElevator: true,
      availableSlots: ['工作日上午'], familyAccompany: true, familyNotes: '女儿可陪同',
      appointmentAt: inDays(1), userNote: '上下楼膝盖疼',
    } as any);
    await this.recordsService.dispatch(r1.id, admin.id, t2.id, '高龄用户请注意强度');
    await this.recordsService.respond(r1.id, t2.id, true);
    await this.recordsService.checkin(r1.id, t2.id, { location: '阳光社区 3 栋（已到场）' });
    await this.recordsService.updateVisit(r1.id, t2.id, {
      painScore: 5, movementLimitation: '左膝屈伸受限，下蹲困难',
      vitals: { bp: '138/86', hr: 76, temp: 36.5, spo2: 97 },
      actualItems: [{ name: '老年膝关节功能训练', price: 188 }],
      equipmentUsed: ['弹力带', '助行器'], techniqueIntensity: '中等',
      userFeedback: '训练后膝盖轻松一些', therapistNote: '按中等强度执行，无不适',
      nextVisitSuggestion: '建议继续疗程，每周 2 次',
    });
    await this.recordsService.completeVisit(r1.id, t2.id);
    await this.settlementsService.pay(r1.id, { id: u1.id, role: UserRole.USER } as any, {
      channel: SettlementChannel.INSURANCE,
    });
    await this.recordsService.addFollowUp(r1.id, { id: t2.id, role: UserRole.THERAPIST } as any, {
      method: '电话', content: '随访：训练后次日膝盖无加重，可继续疗程',
      painScoreAfter: 4, satisfaction: 5, nextPlan: '维持每周 2 次训练',
    });

    // 演示2：刘先生 术后康复 → 王康复，医保通道失败后改自费
    const r2 = await this.recordsService.create(u2.id, {
      serviceItemIds: [byCode('SURG-01').id],
      painParts: ['右膝'], painScoreInitial: 4,
      address: '滨江花园 8 栋 1202', floor: 12, hasElevator: true,
      availableSlots: ['周末下午'], familyAccompany: false,
      appointmentAt: inDays(1), userNote: 'ACL 术后 6 周，医生允许居家康复',
    } as any);
    await this.recordsService.dispatch(r2.id, admin.id, t1.id, null);
    await this.recordsService.respond(r2.id, t1.id, true);
    await this.recordsService.checkin(r2.id, t1.id, { location: '滨江花园 8 栋（已到场）' });
    await this.recordsService.updateVisit(r2.id, t1.id, {
      painScore: 3, movementLimitation: '屈曲 100°，伸直 -5°',
      vitals: { bp: '122/78', hr: 70 },
      actualItems: [{ name: '术后关节活动度训练', price: 268 }],
      equipmentUsed: ['便携按摩床', '弹力带', '角度尺'], techniqueIntensity: '中等',
      userFeedback: '可耐受', therapistNote: '角度较上周进步 5°',
      nextVisitSuggestion: '两周后复查角度',
    });
    await this.recordsService.completeVisit(r2.id, t1.id);
    await this.settlementsService.pay(r2.id, { id: u2.id, role: UserRole.USER } as any, {
      channel: SettlementChannel.INSURANCE, simulateFailure: true,
    });
    await this.settlementsService.pay(r2.id, { id: u2.id, role: UserRole.USER } as any, {
      channel: SettlementChannel.SELF,
    });

    // 演示3：陈女士 产后修复 → 已派单待接单（留给演示接单操作）
    await this.recordsService.create(u3.id, {
      serviceItemIds: [byCode('POST-01').id],
      painParts: ['盆底'], painScoreInitial: 2,
      address: '桂花苑 2 栋 302', floor: 3, hasElevator: false,
      availableSlots: ['工作日下午'], familyAccompany: true,
      appointmentAt: inDays(2), userNote: '产后 3 个月，希望盆底修复',
    } as any).then(async (r3) => {
      await this.recordsService.dispatch(r3.id, admin.id, t3.id, null);
    });
  }
}
