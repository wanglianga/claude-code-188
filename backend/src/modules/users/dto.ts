import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpsertHealthProfileDto {
  @IsOptional() @IsString()
  gender?: string;

  @IsOptional() @IsInt() @Min(0) @Max(120)
  age?: number;

  @IsOptional() @IsString()
  medicalHistory?: string;

  @IsOptional() @IsString()
  medications?: string;

  @IsOptional() @IsString()
  contraindications?: string;

  @IsOptional() @IsArray()
  contraindicationTags?: string[];

  @IsOptional() @IsString()
  imagingReports?: string;

  @IsOptional() @IsString()
  allergies?: string;

  @IsOptional() @IsString()
  insuranceNo?: string;

  @IsOptional() @IsBoolean()
  hasSubsidy?: boolean;
}

export class UpsertTherapistProfileDto {
  @IsOptional() @IsString()
  title?: string;

  @IsOptional() @IsArray()
  skills?: string[];

  @IsOptional() @IsArray()
  equipment?: string[];

  @IsOptional() @IsString()
  serviceArea?: string;

  @IsOptional() @IsInt() @Min(0)
  yearsExp?: number;

  @IsOptional() @IsString()
  bio?: string;
}
