import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class NewCourseDto {
  @IsString()
  serviceItemId: string;

  @IsInt() @Min(2) @Max(60)
  totalSessions: number;
}

export class CreateRecordDto {
  @IsArray()
  @ArrayNotEmpty({ message: '请至少选择一个服务项目' })
  serviceItemIds: string[];

  @IsOptional() @IsArray()
  painParts?: string[];

  @IsInt() @Min(0) @Max(10)
  painScoreInitial: number;

  @IsNotEmpty({ message: '请填写服务地址' })
  address: string;

  @IsInt() @Min(1) @Max(99)
  floor: number;

  @IsBoolean()
  hasElevator: boolean;

  @IsOptional() @IsArray()
  availableSlots?: string[];

  @IsOptional() @IsBoolean()
  familyAccompany?: boolean;

  @IsOptional() @IsString()
  familyNotes?: string;

  @IsNotEmpty({ message: '请选择预约上门时间' })
  appointmentAt: string;

  @IsOptional() @IsString()
  userNote?: string;

  /** 使用已有疗程 */
  @IsOptional() @IsString()
  courseId?: string;

  /** 或新建疗程 */
  @IsOptional()
  @ValidateNested()
  @Type(() => NewCourseDto)
  newCourse?: NewCourseDto;
}

export class DispatchDto {
  @IsNotEmpty({ message: '请选择技师' })
  therapistId: string;

  @IsOptional() @IsString()
  note?: string;
}

export class RespondDto {
  @IsBoolean()
  accept: boolean;

  @IsOptional() @IsString()
  reason?: string;
}

export class CheckinDto {
  @IsOptional() @IsString()
  location?: string;
}

export class VitalsDto {
  @IsOptional() @IsString()
  bp?: string;

  @IsOptional() @IsNumber()
  hr?: number;

  @IsOptional() @IsNumber()
  temp?: number;

  @IsOptional() @IsNumber()
  spo2?: number;
}

export class UpdateVisitDto {
  @IsOptional() @IsInt() @Min(0) @Max(10)
  painScore?: number;

  @IsOptional() @IsString()
  movementLimitation?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => VitalsDto)
  vitals?: VitalsDto;

  @IsOptional() @IsArray()
  actualItems?: { name: string; price: number }[];

  @IsOptional() @IsArray()
  equipmentUsed?: string[];

  @IsOptional() @IsString()
  techniqueIntensity?: string;

  @IsOptional() @IsString()
  userFeedback?: string;

  @IsOptional() @IsString()
  therapistNote?: string;

  @IsOptional() @IsString()
  nextVisitSuggestion?: string;
}

export class AddItemsDto {
  @IsArray()
  @ArrayNotEmpty()
  serviceItemIds: string[];
}

export class FollowUpDto {
  @IsOptional() @IsString()
  method?: string;

  @IsNotEmpty({ message: '请填写随访内容' })
  content: string;

  @IsOptional() @IsInt() @Min(0) @Max(10)
  painScoreAfter?: number;

  @IsOptional() @IsInt() @Min(1) @Max(5)
  satisfaction?: number;

  @IsOptional() @IsString()
  nextPlan?: string;
}

export class ReferralDto {
  @IsNotEmpty({ message: '请填写转诊原因' })
  reason: string;

  @IsNotEmpty({ message: '请填写建议科室' })
  suggestedDepartment: string;

  @IsOptional() @IsString()
  doctorAdvice?: string;
}
