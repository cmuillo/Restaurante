import {
  Injectable, UnauthorizedException, ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken) private readonly tokenRepository: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<User> {
    // addSelect para traer passwordHash que está excluido por defecto
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email AND user.isActive = true', { email })
      .getOne();

    if (!user) {
      // Comparación de tiempo constante para evitar timing attacks
      await bcrypt.compare(password, '$2b$12$invalidhashfortiming');
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return user;
  }

  async login(user: User, userAgent?: string, ipAddress?: string) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.createRefreshToken(user.id, userAgent, ipAddress);

    // Actualizar último login
    await this.userRepository.update(user.id, { lastLoginAt: new Date() });

    return {
      accessToken,
      refreshToken: refreshToken.raw,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        branchId: user.branchId,
      },
    };
  }

  async refreshAccessToken(rawRefreshToken: string): Promise<{ accessToken: string }> {
    const tokenHash = this.hashToken(rawRefreshToken);
    const stored = await this.tokenRepository.findOne({
      where: { tokenHash, revoked: false },
      relations: ['user'],
    });

    if (!stored || new Date() > stored.expiresAt) {
      if (stored) {
        // Token expirado — revocarlo
        await this.tokenRepository.update(stored.id, { revoked: true });
      }
      throw new ForbiddenException('Refresh token inválido o expirado');
    }

    if (!stored.user.isActive) {
      throw new ForbiddenException('Usuario inactivo');
    }

    const payload = {
      sub: stored.user.id,
      email: stored.user.email,
      role: stored.user.role,
      branchId: stored.user.branchId,
    };

    return { accessToken: this.jwtService.sign(payload) };
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawRefreshToken);
    await this.tokenRepository.update({ tokenHash }, { revoked: true });
  }

  async logoutAll(userId: string): Promise<void> {
    // Revoca todos los tokens activos del usuario
    await this.tokenRepository.update({ userId, revoked: false }, { revoked: true });
  }

  private async createRefreshToken(
    userId: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{ raw: string; hash: string }> {
    const raw = randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(raw);

    const expiresIn = this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 días por defecto

    await this.tokenRepository.save({
      userId,
      tokenHash,
      expiresAt,
      userAgent,
      ipAddress,
    });

    return { raw, hash: tokenHash };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }
}
