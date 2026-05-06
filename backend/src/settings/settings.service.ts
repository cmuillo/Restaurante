import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GlobalSettings } from './entities/global-settings.entity';
import { UpdateSettingsDto } from './dto/update-settings.dto';

const SINGLETON_ID = 'main';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(GlobalSettings)
    private readonly repo: Repository<GlobalSettings>,
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
}
