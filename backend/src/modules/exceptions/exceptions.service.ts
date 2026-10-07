import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '../../common/current-user.decorator';
import {
  Dispatch,
  DispatchStatus,
  ExceptionEvent,
  ExceptionStatus,
  ServiceRecord,
  UserRole,
} from '../../entities';
import { CreateExceptionDto, HandleExceptionDto } from './dto';

@Injectable()
export class ExceptionsService {
  constructor(
    @InjectRepository(ExceptionEvent) private exceptions: Repository<ExceptionEvent>,
    @InjectRepository(ServiceRecord) private records: Repository<ServiceRecord>,
    @InjectRepository(Dispatch) private dispatches: Repository<Dispatch>,
  ) {}

  /** 记录参与方上报异常（不适/家属不满/器械故障/退款等） */
  async create(recordId: string, user: AuthUser, dto: CreateExceptionDto) {
    const record = await this.records.findOne({ where: { id: recordId } });
    if (!record) throw new NotFoundException('记录不存在');
    if (user.role === UserRole.USER && record.userId !== user.id) {
      throw new ForbiddenException('无权操作该记录');
    }
    if (user.role === UserRole.THERAPIST) {
      const d = await this.dispatches.findOne({
        where: { recordId, therapistId: user.id, status: DispatchStatus.ACCEPTED },
      });
      if (!d) throw new ForbiddenException('您不是该记录的接单技师');
    }
    return this.exceptions.save(
      this.exceptions.create({
        recordId,
        visitId: dto.visitId || null,
        type: dto.type,
        description: dto.description,
        createdBy: user.id,
        createdByRole: user.role,
        meta: dto.meta || null,
      }),
    );
  }

  /** 异常列表：管理员看全部，技师看自己经手的，用户看自己的 */
  async list(user: AuthUser, filters: { status?: ExceptionStatus; type?: string; recordId?: string }) {
    const all = await this.exceptions.find({ order: { createdAt: 'DESC' } });
    let rows = all;
    if (user.role === UserRole.USER) {
      const myRecords = await this.records.find({ where: { userId: user.id } });
      const ids = new Set(myRecords.map((r) => r.id));
      rows = rows.filter((e) => ids.has(e.recordId));
    } else if (user.role === UserRole.THERAPIST) {
      const myDispatches = await this.dispatches.find({ where: { therapistId: user.id } });
      const ids = new Set(myDispatches.map((d) => d.recordId));
      rows = rows.filter((e) => ids.has(e.recordId));
    }
    if (filters.status) rows = rows.filter((e) => e.status === filters.status);
    if (filters.type) rows = rows.filter((e) => e.type === filters.type);
    if (filters.recordId) rows = rows.filter((e) => e.recordId === filters.recordId);

    // 补充记录编号便于展示
    const recordIds = [...new Set(rows.map((e) => e.recordId))];
    const records = recordIds.length
      ? await this.records.find({ where: recordIds.map((id) => ({ id })) as any })
      : [];
    const noMap = new Map(records.map((r) => [r.id, r.recordNo]));
    return rows.map((e) => ({ ...e, recordNo: noMap.get(e.recordId) }));
  }

  async handle(id: string, adminId: string, dto: HandleExceptionDto) {
    const e = await this.exceptions.findOne({ where: { id } });
    if (!e) throw new NotFoundException('异常不存在');
    if (e.status === ExceptionStatus.RESOLVED || e.status === ExceptionStatus.REJECTED) {
      throw new BadRequestException('该异常已处理完毕');
    }
    e.status = dto.status;
    e.resolution = dto.resolution;
    e.handledBy = adminId;
    if (dto.status === ExceptionStatus.RESOLVED || dto.status === ExceptionStatus.REJECTED) {
      e.resolvedAt = new Date();
    }
    return this.exceptions.save(e);
  }
}
