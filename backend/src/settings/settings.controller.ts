import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { EmailConfigService } from './services/email-config.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UpdateEmailConfigDto } from './dto/email-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly emailConfigService: EmailConfigService,
  ) {}

  /** Lectura pública — disponible para kiosko y todas las apps sin auth */
  @Get()
  @ApiOperation({ summary: 'Obtener configuración global del sistema' })
  getSettings() {
    return this.settingsService.getSettings();
  }

  /** Escritura — solo SUPER_ADMIN */
  @Patch()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Actualizar configuración global (solo SUPER_ADMIN)' })
  updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.updateSettings(dto);
  }

  /** ─── Email Configuration ───────────────────────────────────────────────── */

  @Get('email-config')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Obtener configuración de correo SMTP (sin contraseña)' })
  async getEmailConfig() {
    return this.emailConfigService.getConfigSafe();
  }

  @Patch('email-config')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Actualizar configuración de correo SMTP (solo SUPER_ADMIN)' })
  async updateEmailConfig(@Body() dto: UpdateEmailConfigDto) {
    return this.emailConfigService.updateConfig(dto);
  }
}
