import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GlobalSettings } from './entities/global-settings.entity';
import { EmailConfig } from './entities/email-config.entity';
import { SettingsService } from './settings.service';
import { EmailConfigService } from './services/email-config.service';
import { SettingsController } from './settings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([GlobalSettings, EmailConfig])],
  providers: [SettingsService, EmailConfigService],
  controllers: [SettingsController],
  exports: [SettingsService, EmailConfigService],
})
export class SettingsModule {}
