import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from './entities/branch.entity';
import { BranchConfig } from './entities/branch-config.entity';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

function defaultBusinessHours() {
  return {
    monday: { open: '06:00', close: '22:00', closed: false },
    tuesday: { open: '06:00', close: '22:00', closed: false },
    wednesday: { open: '06:00', close: '22:00', closed: false },
    thursday: { open: '06:00', close: '22:00', closed: false },
    friday: { open: '06:00', close: '22:00', closed: false },
    saturday: { open: '06:00', close: '22:00', closed: false },
    sunday: { open: '06:00', close: '22:00', closed: false },
  };
}

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch) private readonly branchRepository: Repository<Branch>,
    @InjectRepository(BranchConfig) private readonly configRepository: Repository<BranchConfig>,
  ) {}

  async create(dto: CreateBranchDto): Promise<Branch> {
    const branch = this.branchRepository.create(dto);
    const saved = await this.branchRepository.save(branch);

    // Crear configuración por defecto
    await this.configRepository.save({
      branchId: saved.id,
      businessHours: defaultBusinessHours(),
    });

    return saved;
  }

  findAll(includeInactive = false): Promise<Branch[]> {
    if (includeInactive) {
      return this.branchRepository.find({ order: { name: 'ASC' } });
    }

    return this.branchRepository.find({ where: { isActive: true }, order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Branch> {
    const branch = await this.branchRepository.findOne({ where: { id }, relations: ['configs'] });
    if (!branch) throw new NotFoundException('Sucursal no encontrada');
    return branch;
  }

  async update(id: string, dto: UpdateBranchDto): Promise<Branch> {
    await this.branchRepository.update(id, dto);
    return this.findOne(id);
  }

  async getConfig(branchId: string): Promise<BranchConfig> {
    const config = await this.configRepository.findOne({ where: { branchId } });
    if (!config) throw new NotFoundException('Configuración de sucursal no encontrada');

    if (!config.businessHours) {
      config.businessHours = defaultBusinessHours();
      await this.configRepository.save(config);
    }

    return config;
  }

  async updateConfig(branchId: string, dto: Partial<BranchConfig>): Promise<BranchConfig> {
    await this.configRepository.update({ branchId }, dto as any);
    return this.getConfig(branchId);
  }
}
