import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class AuthCredentialsDto {
  @IsString()
  @MinLength(3, { message: '아이디는 3자 이상이어야 해요.' })
  @MaxLength(20, { message: '아이디는 20자 이하여야 해요.' })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: '아이디는 영문, 숫자, 밑줄(_)만 쓸 수 있어요.',
  })
  username: string;

  @IsString()
  @MinLength(4, { message: '비밀번호는 4자 이상이어야 해요.' })
  @MaxLength(72, { message: '비밀번호는 72자 이하여야 해요.' })
  password: string;
}
