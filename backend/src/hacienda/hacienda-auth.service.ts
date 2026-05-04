import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BranchConfig } from '../branches/entities/branch-config.entity';

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

/**
 * Gestiona el token OAuth2 para la API de Comprobantes Electrónicos de Hacienda CR.
 * Acepta la config de BranchConfig (UI admin) o bien de variables de entorno como fallback.
 */
@Injectable()
export class HaciendaAuthService {
  private readonly logger = new Logger(HaciendaAuthService.name);
  /** Cache por branchId (o 'default' cuando se usa .env) */
  private readonly tokenCaches = new Map<string, TokenCache>();

  constructor(private readonly config: ConfigService) {}

  /**
   * Obtiene el access_token vigente para la configuración dada.
   * Acepta un BranchConfig (leído desde DB) o bien usa .env si no se pasa.
   */
  async getAccessToken(branchConfig?: BranchConfig): Promise<string> {
    const cacheKey = branchConfig?.branchId ?? 'default';
    const now = Date.now();
    const cached = this.tokenCaches.get(cacheKey);

    if (cached && cached.expiresAt - now > 60_000) {
      return cached.accessToken;
    }

    this.logger.log('Renovando token OAuth2 de Hacienda…');

    const idpUrl   = branchConfig?.haciendaIdpUrl   ?? this.config.get<string>('HACIENDA_IDP_URL');
    const clientId = branchConfig?.haciendaClientId  ?? this.config.get<string>('HACIENDA_CLIENT_ID');
    const username = branchConfig?.haciendaUsername  ?? this.config.get<string>('HACIENDA_USERNAME');
    const password = branchConfig?.haciendaPassword  ?? this.config.get<string>('HACIENDA_PASSWORD');

    const params = new URLSearchParams({
      grant_type: 'password',
      client_id: clientId ?? '',
      username: username ?? '',
      password: password ?? '',
    });

    const response = await fetch(idpUrl!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`IDP Hacienda respondió ${response.status}`);
    const { access_token, expires_in } = await response.json() as { access_token: string; expires_in: number };

    this.tokenCaches.set(cacheKey, {
      accessToken: access_token,
      expiresAt: now + expires_in * 1000,
    });

    this.logger.log('Token OAuth2 renovado correctamente');
    return access_token;
  }
}
