import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { SettlementChannel } from '../../entities';

export class PayDto {
  @IsEnum(SettlementChannel, { message: '结算通道无效' })
  channel: SettlementChannel;

  /** 演示用：模拟医保/补贴通道结算失败 */
  @IsOptional() @IsBoolean()
  simulateFailure?: boolean;
}

export class RefundRequestDto {
  @IsNotEmpty({ message: '请填写退款原因' })
  reason: string;

  @IsOptional() @IsNumber() @Min(0.01)
  amount?: number;
}

export class RefundHandleDto {
  @IsBoolean()
  approve: boolean;

  @IsNotEmpty({ message: '请填写处理说明' })
  resolution: string;
}
