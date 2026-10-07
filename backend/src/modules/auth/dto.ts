import { IsIn, IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';

export class RegisterDto {
  @Matches(/^1\d{10}$/, { message: '手机号格式不正确' })
  phone: string;

  @IsString()
  @Length(6, 32, { message: '密码长度需 6-32 位' })
  password: string;

  @IsNotEmpty({ message: '姓名不能为空' })
  name: string;

  @IsOptional()
  @IsIn(['USER', 'THERAPIST'], { message: '仅支持注册用户或技师账号' })
  role?: 'USER' | 'THERAPIST';
}

export class LoginDto {
  @IsNotEmpty({ message: '手机号不能为空' })
  phone: string;

  @IsNotEmpty({ message: '密码不能为空' })
  password: string;
}
