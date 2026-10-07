import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuthUser } from '../../common/current-user.decorator';
import {
  Course,
  CourseStatus,
  Dispatch,
  DispatchStatus,
  ExceptionEvent,
  ExceptionType,
  FollowUp,
  HealthProfile,
  RecordItem,
  RecordStatus,
  Referral,
  RiskAssessment,
  ServiceItem,
  ServiceRecord,
  Settlement,
  User,
  UserRole,
  Visit,
  VisitStatus,
} from '../../entities';
import {
  AddItemsDto,
  CheckinDto,
  CreateRecordDto,
  FollowUpDto,
  ReferralDto,
  UpdateVisitDto,
} from './dto';
import { evaluateRisk } from './risk.engine';

const LATE_THRESHOLD_MIN = 15; // 超过预约时间 15 分钟签到记为技师迟到

@Injectable()
export class RecordsService {
  constructor(
    @InjectRepository(ServiceRecord) private records: Repository<ServiceRecord>,
    @InjectRepository(RecordItem) private recordItems: Repository<RecordItem>,
    @InjectRepository(RiskAssessment) private risks: Repository<RiskAssessment>,
    @InjectRepository(Dispatch) private dispatches: Repository<Dispatch>,
    @InjectRepository(Visit) private visits: Repository<Visit>,
    @InjectRepository(Course) private courses: Repository<Course>,
    @InjectRepository(ServiceItem) private serviceItems: Repository<ServiceItem>,
    @InjectRepository(HealthProfile) private profiles: Repository<HealthProfile>,
    @InjectRepository(ExceptionEvent) private exceptions: Repository<ExceptionEvent>,
    @InjectRepository(Settlement) private settlements: Repository<Settlement>,
    @InjectRepository(FollowUp) private followUps: Repository<FollowUp>,
    @InjectRepository(Referral) private referrals: Repository<Referral>,
    @InjectRepository(User) private users: Repository<User>,
  ) {}

  // ---------- 用户预约 ----------

  async create(userId: string, dto: CreateRecordDto) {
    const items = await this.serviceItems.find({ where: { id: In(dto.serviceItemIds), active: true } });
    if (items.length !== dto.serviceItemIds.length) {
      throw new BadRequestException('存在无效或已下架的服务项目');
    }

    // 疗程处理：使用已有疗程或新建疗程
    let course: Course | null = null;
    let sessionNo = 1;
    let totalSessions = 1;
    if (dto.courseId) {
      course = await this.courses.findOne({ where: { id: dto.courseId, userId } });
      if (!course || course.status !== CourseStatus.ACTIVE) {
        throw new BadRequestException('疗程不存在或已结束');
      }
      sessionNo = course.usedSessions + 1;
      totalSessions = course.totalSessions;
    } else if (dto.newCourse) {
      const item = items.find((i) => i.id === dto.newCourse.serviceItemId);
      if (!item) throw new BadRequestException('疗程项目必须包含在所选项目中');
      course = await this.courses.save(
        this.courses.create({
          userId,
          serviceItemId: item.id,
          name: `${item.name}·${dto.newCourse.totalSessions}次疗程`,
          totalSessions: dto.newCourse.totalSessions,
        }),
      );
      totalSessions = course.totalSessions;
    }

    const record = await this.records.save(
      this.records.create({
        recordNo: this.genRecordNo(),
        userId,
        painParts: dto.painParts || [],
        painScoreInitial: dto.painScoreInitial,
        address: dto.address,
        floor: dto.floor,
        hasElevator: dto.hasElevator,
        availableSlots: dto.availableSlots || [],
        familyAccompany: !!dto.familyAccompany,
        familyNotes: dto.familyNotes,
        appointmentAt: new Date(dto.appointmentAt),
        userNote: dto.userNote,
        courseId: course?.id || null,
        sessionNo,
        totalSessions,
        status: RecordStatus.PENDING_DISPATCH,
      }),
    );

    await this.recordItems.save(
      items.map((i) =>
        this.recordItems.create({
          recordId: record.id,
          serviceItemId: i.id,
          name: i.name,
          price: i.price,
          quantity: 1,
        }),
      ),
    );

    // 自动生成风险评估（健康风险优先于商业疗程）
    const profile = await this.profiles.findOne({ where: { userId } });
    const risk = evaluateRisk(profile, record, items);
    await this.risks.save(this.risks.create({ recordId: record.id, ...risk }));

    return this.detail(record.id, { id: userId, role: UserRole.USER } as AuthUser);
  }

  private genRecordNo() {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `SR${ymd}${rand}`;
  }

  myRecords(userId: string) {
    return this.records.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async myCourses(userId: string) {
    const courses = await this.courses.find({
      where: { userId },
      relations: ['serviceItem'],
      order: { createdAt: 'DESC' },
    });
    return courses;
  }

  // ---------- 记录详情（同一健康服务记录聚合视图） ----------

  async detail(id: string, user: AuthUser) {
    const record = await this.records.findOne({ where: { id }, relations: ['user'] });
    if (!record) throw new NotFoundException('记录不存在');
    await this.assertCanView(record, user);

    const [items, riskAssessment, dispatches, visits, exceptions, settlement, followUps, referrals, profile] =
      await Promise.all([
        this.recordItems.find({ where: { recordId: id } }),
        this.risks.findOne({ where: { recordId: id } }),
        this.dispatches.find({ where: { recordId: id }, relations: ['therapist'], order: { assignedAt: 'DESC' } }),
        this.visits.find({ where: { recordId: id }, relations: ['therapist'], order: { createdAt: 'DESC' } }),
        this.exceptions.find({ where: { recordId: id }, order: { createdAt: 'DESC' } }),
        this.settlements.findOne({ where: { recordId: id } }),
        this.followUps.find({ where: { recordId: id }, order: { createdAt: 'DESC' } }),
        this.referrals.find({ where: { recordId: id }, order: { createdAt: 'DESC' } }),
        this.profiles.findOne({ where: { userId: record.userId } }),
      ]);

    let course = null;
    if (record.courseId) {
      course = await this.courses.findOne({ where: { id: record.courseId }, relations: ['serviceItem'] });
    }

    const sanitize = (u: User) => (u ? { id: u.id, name: u.name, phone: u.phone } : null);
    return {
      ...record,
      user: sanitize(record.user),
      items,
      riskAssessment,
      dispatches: dispatches.map((d) => ({ ...d, therapist: sanitize(d.therapist) })),
      visits: visits.map((v) => ({ ...v, therapist: sanitize(v.therapist) })),
      exceptions,
      settlement,
      followUps,
      referrals,
      course,
      healthProfile: profile,
    };
  }

  private async assertCanView(record: ServiceRecord, user: AuthUser) {
    if (user.role === UserRole.ADMIN) return;
    if (record.userId === user.id) return;
    if (user.role === UserRole.THERAPIST) {
      const d = await this.dispatches.findOne({
        where: { recordId: record.id, therapistId: user.id, status: In([DispatchStatus.PENDING, DispatchStatus.ACCEPTED]) },
      });
      if (d) return;
    }
    throw new ForbiddenException('无权查看该记录');
  }

  /** 管理端列表（可按状态/技师/类目/异常过滤） */
  async listAll(filters: { status?: RecordStatus; therapistId?: string; category?: string; hasException?: string }) {
    const records = await this.records.find({ relations: ['user'], order: { createdAt: 'DESC' } });
    const [items, dispatches, exceptions, settlements] = await Promise.all([
      this.recordItems.find(),
      this.dispatches.find({ relations: ['therapist'] }),
      this.exceptions.find(),
      this.settlements.find(),
    ]);
    const serviceItems = await this.serviceItems.find();
    const itemCat = new Map(serviceItems.map((s) => [s.id, s.category]));

    let rows = records.map((r) => {
      const rItems = items.filter((i) => i.recordId === r.id);
      const rDispatch = dispatches.find((d) => d.recordId === r.id && d.status === DispatchStatus.ACCEPTED)
        || dispatches.filter((d) => d.recordId === r.id).sort((a, b) => +new Date(b.assignedAt) - +new Date(a.assignedAt))[0];
      const rExceptions = exceptions.filter((e) => e.recordId === r.id);
      const settlement = settlements.find((s) => s.recordId === r.id);
      return {
        ...r,
        user: r.user ? { id: r.user.id, name: r.user.name, phone: r.user.phone } : null,
        itemNames: rItems.map((i) => i.name),
        categories: [...new Set(rItems.map((i) => itemCat.get(i.serviceItemId)))],
        therapist: rDispatch?.therapist ? { id: rDispatch.therapist.id, name: rDispatch.therapist.name } : null,
        exceptionCount: rExceptions.length,
        openExceptionCount: rExceptions.filter((e) => e.status === 'OPEN' || e.status === 'PROCESSING').length,
        settlementStatus: settlement?.status || null,
        totalAmount: rItems.reduce((s, i) => s + Number(i.price) * i.quantity, 0),
      };
    });

    if (filters.status) rows = rows.filter((r) => r.status === filters.status);
    if (filters.therapistId) rows = rows.filter((r) => r.therapist?.id === filters.therapistId);
    if (filters.category) rows = rows.filter((r) => (r.categories as string[]).includes(filters.category));
    if (filters.hasException === 'true') rows = rows.filter((r) => r.exceptionCount > 0);
    return rows;
  }

  async cancel(id: string, user: AuthUser) {
    const record = await this.records.findOne({ where: { id } });
    if (!record) throw new NotFoundException('记录不存在');
    if (user.role !== UserRole.ADMIN && record.userId !== user.id) throw new ForbiddenException('无权操作');
    if (![RecordStatus.PENDING_DISPATCH, RecordStatus.DISPATCHED, RecordStatus.ACCEPTED].includes(record.status)) {
      throw new BadRequestException('当前状态不可取消');
    }
    record.status = RecordStatus.CANCELLED;
    await this.records.save(record);
    await this.dispatches.update(
      { recordId: id, status: DispatchStatus.PENDING },
      { status: DispatchStatus.CANCELLED },
    );
    return record;
  }

  // ---------- 派单 / 接单 ----------

  async dispatch(id: string, adminId: string, therapistId: string, note?: string) {
    const record = await this.records.findOne({ where: { id } });
    if (!record) throw new NotFoundException('记录不存在');
    if (record.status !== RecordStatus.PENDING_DISPATCH) {
      throw new BadRequestException('仅待派单状态可派单');
    }
    const therapist = await this.users.findOne({ where: { id: therapistId, role: UserRole.THERAPIST, active: true } });
    if (!therapist) throw new BadRequestException('技师不存在或已停用');
    await this.dispatches.save(
      this.dispatches.create({ recordId: id, therapistId, note, assignedBy: adminId }),
    );
    record.status = RecordStatus.DISPATCHED;
    await this.records.save(record);
    return this.detail(id, { id: adminId, role: UserRole.ADMIN } as AuthUser);
  }

  /** 技师待接订单（含风险评估与所需器械） */
  async therapistQueue(therapistId: string) {
    const pending = await this.dispatches.find({
      where: { therapistId, status: DispatchStatus.PENDING },
      order: { assignedAt: 'DESC' },
    });
    const result = [];
    for (const d of pending) {
      const detail = await this.detail(d.recordId, { id: therapistId, role: UserRole.THERAPIST } as AuthUser);
      result.push({ dispatch: d, record: detail });
    }
    return result;
  }

  /** 技师已接/服务中/已完成订单 */
  async therapistOrders(therapistId: string) {
    const accepted = await this.dispatches.find({
      where: { therapistId, status: DispatchStatus.ACCEPTED },
      order: { respondedAt: 'DESC' },
    });
    const result = [];
    for (const d of accepted) {
      const record = await this.records.findOne({ where: { id: d.recordId }, relations: ['user'] });
      if (!record || record.status === RecordStatus.CANCELLED) continue;
      const items = await this.recordItems.find({ where: { recordId: record.id } });
      result.push({
        dispatch: d,
        record: {
          ...record,
          user: record.user ? { id: record.user.id, name: record.user.name, phone: record.user.phone } : null,
        },
        items,
      });
    }
    return result;
  }

  async respond(id: string, therapistId: string, accept: boolean, reason?: string) {
    const dispatch = await this.dispatches.findOne({
      where: { recordId: id, therapistId, status: DispatchStatus.PENDING },
    });
    if (!dispatch) throw new BadRequestException('没有待响应的派单');
    const record = await this.records.findOne({ where: { id } });
    if (!record || record.status !== RecordStatus.DISPATCHED) {
      throw new BadRequestException('记录状态已变化，请刷新');
    }
    dispatch.respondedAt = new Date();
    if (accept) {
      dispatch.status = DispatchStatus.ACCEPTED;
      record.status = RecordStatus.ACCEPTED;
    } else {
      dispatch.status = DispatchStatus.REJECTED;
      dispatch.rejectReason = reason || '未填写原因';
      record.status = RecordStatus.PENDING_DISPATCH; // 回到待派单
    }
    await this.dispatches.save(dispatch);
    await this.records.save(record);
    return { dispatch, recordStatus: record.status };
  }

  // ---------- 上门服务 ----------

  private async acceptedDispatch(recordId: string, therapistId: string) {
    const d = await this.dispatches.findOne({
      where: { recordId, therapistId, status: DispatchStatus.ACCEPTED },
    });
    if (!d) throw new ForbiddenException('您不是该记录的接单技师');
    return d;
  }

  async checkin(id: string, therapistId: string, dto: CheckinDto) {
    const record = await this.records.findOne({ where: { id } });
    if (!record) throw new NotFoundException('记录不存在');
    if (record.status !== RecordStatus.ACCEPTED) throw new BadRequestException('当前状态不可签到');
    await this.acceptedDispatch(id, therapistId);

    const now = new Date();
    const visit = await this.visits.save(
      this.visits.create({
        recordId: id,
        therapistId,
        checkinAt: now,
        checkinLocation: dto.location || record.address,
        status: VisitStatus.CHECKED_IN,
      }),
    );
    record.status = RecordStatus.IN_SERVICE;
    await this.records.save(record);

    // 技师迟到自动记异常
    if (record.appointmentAt && now.getTime() - new Date(record.appointmentAt).getTime() > LATE_THRESHOLD_MIN * 60_000) {
      const lateMin = Math.round((now.getTime() - new Date(record.appointmentAt).getTime()) / 60000);
      await this.exceptions.save(
        this.exceptions.create({
          recordId: id,
          visitId: visit.id,
          type: ExceptionType.TECH_LATE,
          description: `技师迟到 ${lateMin} 分钟（预约 ${new Date(record.appointmentAt).toLocaleString('zh-CN')}，实际签到 ${now.toLocaleString('zh-CN')}）`,
          createdBy: null,
          createdByRole: 'SYSTEM',
          meta: { lateMinutes: lateMin },
        }),
      );
    }
    return visit;
  }

  async currentVisit(recordId: string) {
    return this.visits.findOne({
      where: { recordId, status: VisitStatus.CHECKED_IN },
      order: { createdAt: 'DESC' },
    });
  }

  async updateVisit(id: string, therapistId: string, dto: UpdateVisitDto) {
    const record = await this.records.findOne({ where: { id } });
    if (!record) throw new NotFoundException('记录不存在');
    await this.acceptedDispatch(id, therapistId);
    const visit = await this.currentVisit(id);
    if (!visit) throw new BadRequestException('没有进行中的服务，请先签到');
    Object.assign(visit, dto);
    return this.visits.save(visit);
  }

  /** 服务中临时加项：记录明细 + 自动登记加项异常 */
  async addItems(id: string, therapistId: string, dto: AddItemsDto) {
    const record = await this.records.findOne({ where: { id } });
    if (!record) throw new NotFoundException('记录不存在');
    if (record.status !== RecordStatus.IN_SERVICE) throw new BadRequestException('仅服务中可临时加项');
    await this.acceptedDispatch(id, therapistId);
    const items = await this.serviceItems.find({ where: { id: In(dto.serviceItemIds), active: true } });
    if (!items.length) throw new BadRequestException('项目无效');
    await this.recordItems.save(
      items.map((i) =>
        this.recordItems.create({
          recordId: id,
          serviceItemId: i.id,
          name: i.name,
          price: i.price,
          quantity: 1,
          addedDuringVisit: true,
        }),
      ),
    );
    const visit = await this.currentVisit(id);
    await this.exceptions.save(
      this.exceptions.create({
        recordId: id,
        visitId: visit?.id || null,
        type: ExceptionType.ADD_ITEM,
        description: `用户临时要求增加项目：${items.map((i) => i.name).join('、')}`,
        createdBy: therapistId,
        createdByRole: 'THERAPIST',
        meta: { items: items.map((i) => ({ id: i.id, name: i.name, price: i.price })) },
      }),
    );
    return this.recordItems.find({ where: { recordId: id } });
  }

  /** 完成本次服务：生成结算单、推进疗程 */
  async completeVisit(id: string, therapistId: string) {
    const record = await this.records.findOne({ where: { id } });
    if (!record) throw new NotFoundException('记录不存在');
    if (record.status !== RecordStatus.IN_SERVICE) throw new BadRequestException('当前状态不可完成');
    await this.acceptedDispatch(id, therapistId);
    const visit = await this.currentVisit(id);
    if (!visit) throw new BadRequestException('没有进行中的服务');
    if (visit.painScore == null) throw new BadRequestException('请先填写本次疼痛评分等服务记录');

    visit.status = VisitStatus.COMPLETED;
    visit.completedAt = new Date();
    await this.visits.save(visit);

    record.status = RecordStatus.COMPLETED;
    await this.records.save(record);

    // 推进疗程
    if (record.courseId) {
      const course = await this.courses.findOne({ where: { id: record.courseId } });
      if (course && course.status === CourseStatus.ACTIVE) {
        course.usedSessions = Math.min(course.usedSessions + 1, course.totalSessions);
        if (course.usedSessions >= course.totalSessions) course.status = CourseStatus.COMPLETED;
        await this.courses.save(course);
      }
    }

    // 生成结算单（医保/社区补贴/自费拆分）
    const items = await this.recordItems.find({ where: { recordId: id } });
    const total = items.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
    const profile = await this.profiles.findOne({ where: { userId: record.userId } });
    const insurance = profile?.insuranceNo ? Math.min(total * 0.6, 200) : 0;
    const subsidy = profile?.hasSubsidy ? Math.min((total - insurance) * 0.3, 100) : 0;
    const settlement = await this.settlements.save(
      this.settlements.create({
        recordId: id,
        totalAmount: total,
        insuranceAmount: Math.round(insurance * 100) / 100,
        subsidyAmount: Math.round(subsidy * 100) / 100,
        selfPayAmount: Math.round((total - insurance - subsidy) * 100) / 100,
      }),
    );
    return { visit, settlement };
  }

  // ---------- 随访 / 转诊 ----------

  async addFollowUp(id: string, user: AuthUser, dto: FollowUpDto) {
    const record = await this.records.findOne({ where: { id } });
    if (!record) throw new NotFoundException('记录不存在');
    if (user.role === UserRole.THERAPIST) await this.acceptedDispatch(id, user.id);
    else if (user.role !== UserRole.ADMIN) throw new ForbiddenException('仅技师或管理员可随访');
    const lastVisit = await this.visits.findOne({ where: { recordId: id }, order: { createdAt: 'DESC' } });
    return this.followUps.save(
      this.followUps.create({
        recordId: id,
        visitId: lastVisit?.id || null,
        method: dto.method || '电话',
        content: dto.content,
        painScoreAfter: dto.painScoreAfter,
        satisfaction: dto.satisfaction,
        nextPlan: dto.nextPlan,
        createdBy: user.id,
      }),
    );
  }

  async addReferral(id: string, user: AuthUser, dto: ReferralDto) {
    const record = await this.records.findOne({ where: { id } });
    if (!record) throw new NotFoundException('记录不存在');
    if (user.role === UserRole.THERAPIST) await this.acceptedDispatch(id, user.id);
    else if (user.role !== UserRole.ADMIN) throw new ForbiddenException('仅技师或管理员可登记转诊');
    const referral = await this.referrals.save(
      this.referrals.create({
        recordId: id,
        reason: dto.reason,
        suggestedDepartment: dto.suggestedDepartment,
        doctorAdvice: dto.doctorAdvice,
        createdBy: user.id,
      }),
    );
    // 转诊建议同步登记为异常事件，纳入管理端异常率统计
    await this.exceptions.save(
      this.exceptions.create({
        recordId: id,
        type: ExceptionType.REFERRAL_SUGGESTED,
        description: `建议转诊至${dto.suggestedDepartment}：${dto.reason}`,
        createdBy: user.id,
        createdByRole: user.role,
      }),
    );
    return referral;
  }
}
