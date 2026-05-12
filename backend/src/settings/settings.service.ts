
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GlobalSettings } from './entities/global-settings.entity';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { Invoice } from '../billing/entities/invoice.entity';
import { BranchConfig } from '../branches/entities/branch-config.entity';
const SINGLETON_ID = 'main';

@Injectable()
export class SettingsService {

  constructor(
    @InjectRepository(GlobalSettings)
    private readonly repo: Repository<GlobalSettings>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(BranchConfig)
    private readonly branchConfigRepo: Repository<BranchConfig>,
  ) {}
  async getSettings(): Promise<GlobalSettings> {
    let settings = await this.repo.findOne({ where: { id: SINGLETON_ID } });
    if (!settings) {
      settings = this.repo.create({ id: SINGLETON_ID });
      await this.repo.save(settings);
    }
    return settings;
  }


  async updateSettings(dto: UpdateSettingsDto): Promise<GlobalSettings> {
    const settings = await this.getSettings();
    Object.assign(settings, dto);
    return this.repo.save(settings);
  }

  async getBillingStatus(branchId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const branchConfig = await this.branchConfigRepo.findOne({
      where: { branchId },
      select: ['haciendaEnabled'],
    });

    const haciendaEnabled = branchConfig?.haciendaEnabled ?? false;

    if (!haciendaEnabled) {
      return {
        pendingCount: 0,
        errorCount: 0,
        rejectedCount: 0,
        haciendaEnabled: false,
      };
    }

    const invoices = await this.invoiceRepo
      .createQueryBuilder('invoice')
      .innerJoin('invoice.order', 'order')
      .where('order.branchId = :branchId', { branchId })
      .andWhere('invoice.createdAt >= :today', { today })
      .getMany();

    const pendingCount = invoices.filter((inv) => inv.haciendaStatus === 'pending').length;
    const errorCount = invoices.filter((inv) => inv.haciendaStatus === 'error').length;
    const rejectedCount = invoices.filter((inv) => inv.haciendaStatus === 'rejected').length;

    return {
      pendingCount,
      errorCount,
      rejectedCount,
      haciendaEnabled,
    };
  }
}
