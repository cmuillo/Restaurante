import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailConfig } from '../entities/email-config.entity';
import { UpdateEmailConfigDto } from '../dto/email-config.dto';

@Injectable()
export class EmailConfigService {
  constructor(
    @InjectRepository(EmailConfig)
    private readonly emailConfigRepository: Repository<EmailConfig>,
  ) {}

  /**
   * Obtiene la configuración de correo (singleton).
   * Si no existe, crea una con valores por defecto.
   */
  async getConfig(): Promise<EmailConfig> {
    let config = await this.emailConfigRepository.findOne({ where: { id: 'main' } });

    if (!config) {
      config = this.emailConfigRepository.create({
        id: 'main',
        isEnabled: false,
      });
      await this.emailConfigRepository.save(config);
    }

    return config;
  }

  /**
   * Actualiza la configuración de correo.
   */
  async updateConfig(dto: UpdateEmailConfigDto): Promise<EmailConfig> {
    let config = await this.getConfig();

    // Actualiza solo los campos proporcionados
    Object.assign(config, dto);

    return this.emailConfigRepository.save(config);
  }

  /**
   * Obtiene la configuración de correo sin exponer la contraseña.
   */
  async getConfigSafe(): Promise<Omit<EmailConfig, 'smtpPassword'>> {
    const config = await this.getConfig();
    const { smtpPassword, ...safe } = config;
    return safe;
  }
}
