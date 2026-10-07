import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ExceptionStatus, ExceptionType } from '../../entities';

export class CreateExceptionDto {
  @IsEnum(ExceptionType, { message: '异常类型无效' })
  type: ExceptionType;

  @IsNotEmpty({ message: '请填写异常描述' })
  description: string;

  @IsOptional() @IsString()
  visitId?: string;

  @IsOptional()
  meta?: Record<string, any>;
}

export class HandleExceptionDto {
  @IsEnum([ExceptionStatus.PROCESSING, ExceptionStatus.RESOLVED, ExceptionStatus.REJECTED])
  status: ExceptionStatus;

  @IsNotEmpty({ message: '请填写处理说明' })
  resolution: string;
}
