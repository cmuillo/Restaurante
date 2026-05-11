import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {}

  async create(dto: CreateUserDto): Promise<Omit<User, 'passwordHash'>> {
    const existing = await this.userRepository.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('El email ya está registrado');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = this.userRepository.create({ ...dto, passwordHash });
    await this.userRepository.save(user);

    const { passwordHash: _, ...result } = user;
    return result;
  }

  findAll(branchId?: string): Promise<User[]> {
    const where: Partial<User> = {};
    if (branchId) where.branchId = branchId;
    return this.userRepository.find({ where, relations: ['branch'], select: ['id', 'name', 'email', 'role', 'branchId', 'isActive', 'lastLoginAt'], order: { isActive: 'DESC', name: 'ASC' } });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      select: ['id', 'name', 'email', 'role', 'branchId', 'isActive', 'lastLoginAt', 'createdAt'],
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    if (dto.password) {
      (dto as any).passwordHash = await bcrypt.hash(dto.password, 12);
      delete dto.password;
    }
    await this.userRepository.update(id, dto as any);
    return this.findOne(id);
  }

  async deactivate(id: string): Promise<void> {
    await this.userRepository.update(id, { isActive: false });
  }
}
