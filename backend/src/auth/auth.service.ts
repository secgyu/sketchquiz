import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UserService } from '../user/user.service';
import { AuthCredentialsDto } from './dto/auth-credentials.dto';
import type { JwtPayload } from './jwt.strategy';

export interface AuthResult {
  accessToken: string;
  user: { id: string; username: string };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: AuthCredentialsDto): Promise<AuthResult> {
    const existing = await this.users.findByUsername(dto.username);
    if (existing) throw new ConflictException('이미 사용 중인 아이디예요.');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.users.create(dto.username, passwordHash);
    return this.issueToken(user.id, user.username);
  }

  async login(dto: AuthCredentialsDto): Promise<AuthResult> {
    const user = await this.users.findByUsername(dto.username);
    const passwordMatches =
      user && (await bcrypt.compare(dto.password, user.password));
    if (!user || !passwordMatches) {
      throw new UnauthorizedException(
        '아이디 또는 비밀번호가 올바르지 않아요.',
      );
    }
    return this.issueToken(user.id, user.username);
  }

  private issueToken(id: string, username: string): AuthResult {
    const payload: JwtPayload = { sub: id, username };
    return {
      accessToken: this.jwt.sign(payload),
      user: { id, username },
    };
  }
}
