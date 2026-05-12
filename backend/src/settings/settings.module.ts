import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GlobalSettings } from './entities/global-settings.entity';
import { EmailConfig } from './entities/email-config.entity';
import { SettingsService } from './settings.service';
import { EmailConfigService } from './services/email-config.service';
import { SettingsController } from './settings.controller';
import { Invoice } from '../billing/entities/invoice.entity';
import { BranchConfig } from '../branches/entities/branch-config.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GlobalSettings, EmailConfig, Invoice, BranchConfig])],
  providers: [SettingsService, EmailConfigService],
  controllers: [SettingsController],
  exports: [SettingsService, EmailConfigService],
})
export class SettingsModule {}
