import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ServiceCategory } from '../../entities';

export class ServiceItemDto {
  @IsNotEmpty()
  code: string;

  @IsNotEmpty()
  name: string;

  @IsEnum(ServiceCategory)
  category: ServiceCategory;

  @IsOptional() @IsString()
  description?: string;

  @IsNumber() @Min(0)
  price: number;

  @IsInt() @Min(10) @Max(240)
  durationMin: number;

  @IsInt() @Min(1) @Max(3)
  baseRisk: number;

  @IsOptional() @IsArray()
  requiredEquipment?: string[];

  @IsOptional() @IsArray()
  contraindicationTags?: string[];

  @IsOptional() @IsBoolean()
  active?: boolean;
}
