import { Injectable, Logger } from '@nestjs/common';

interface ExchangeRateCache {
  usd: {
    value: number;
    buy: number;
    sell: number;
    fetchedAt: number;
  };
  eur: {
    value: number;
    dolares: number;
    fetchedAt: number;
  };
}

interface HaciendaExchangeRateResponse {
  dolar: {
    venta: { fecha: string; valor: number };
    compra: { fecha: string; valor: number };
  };
  euro: {
    fecha: string;
    dolares: number;
    colones: number;
  };
}

@Injectable()
export class HaciendaExchangeRateService {
  private readonly logger = new Logger(HaciendaExchangeRateService.name);
  private readonly API_BASE = 'https://api.hacienda.go.cr/indicadores/tc';
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutos
  private cache: ExchangeRateCache | null = null;

  /**
   * Obtiene el tipo de cambio USD (compra/venta promedio)
   * Retorna el promedio entre compra y venta
   */
  async getUsdRate(): Promise<number> {
    const rates = await this.fetchExchangeRates();
    return rates.usd.value;
  }

  /**
   * Obtiene el tipo de cambio USD detallado (compra, venta, promedio)
   */
  async getUsdDetailedRate(): Promise<{
    buy: number;
    sell: number;
    average: number;
    date: string;
  }> {
    const rates = await this.fetchExchangeRates();
    return {
      buy: rates.usd.buy,
      sell: rates.usd.sell,
      average: rates.usd.value,
      date: new Date().toISOString().split('T')[0],
    };
  }

  /**
   * Obtiene el tipo de cambio EUR
   * Retorna el valor en colones
   */
  async getEurRate(): Promise<number> {
    const rates = await this.fetchExchangeRates();
    return rates.eur.value;
  }

  /**
   * Obtiene el tipo de cambio EUR detallado (dólares, colones)
   */
  async getEurDetailedRate(): Promise<{
    dolares: number;
    colones: number;
    date: string;
  }> {
    const rates = await this.fetchExchangeRates();
    return {
      dolares: rates.eur.dolares,
      colones: rates.eur.value,
      date: new Date().toISOString().split('T')[0],
    };
  }

  /**
   * Obtiene ambos tipos de cambio
   */
  async getExchangeRates(): Promise<{
    usd: { value: number; buy: number; sell: number };
    eur: { value: number; dolares: number };
    fetchedAt: string;
  }> {
    const rates = await this.fetchExchangeRates();
    return {
      usd: {
        value: rates.usd.value,
        buy: rates.usd.buy,
        sell: rates.usd.sell,
      },
      eur: {
        value: rates.eur.value,
        dolares: rates.eur.dolares,
      },
      fetchedAt: new Date(rates.usd.fetchedAt).toISOString(),
    };
  }

  private async fetchExchangeRates(): Promise<ExchangeRateCache> {
    // Verificar cache
    if (
      this.cache &&
      Date.now() - this.cache.usd.fetchedAt < this.CACHE_TTL &&
      Date.now() - this.cache.eur.fetchedAt < this.CACHE_TTL
    ) {
      this.logger.debug('Usando tipos de cambio del cache');
      return this.cache as ExchangeRateCache;
    }

    try {
      const response = await fetch(this.API_BASE, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} from Hacienda API`);
      }

      const data: HaciendaExchangeRateResponse = await response.json();

      // Validar respuesta
      if (!data.dolar || !data.euro) {
        throw new Error('Invalid Hacienda API response structure');
      }

      const usdBuy = data.dolar.compra.valor;
      const usdSell = data.dolar.venta.valor;
      const usdAverage = (usdBuy + usdSell) / 2;

      const newCache: ExchangeRateCache = {
        usd: {
          value: usdAverage,
          buy: usdBuy,
          sell: usdSell,
          fetchedAt: Date.now(),
        },
        eur: {
          value: data.euro.colones,
          dolares: data.euro.dolares,
          fetchedAt: Date.now(),
        },
      };

      this.cache = newCache;

      this.logger.debug(
        `Tipos de cambio obtenidos de API Hacienda: USD=${usdAverage.toFixed(2)}, EUR=${data.euro.colones.toFixed(2)}`,
      );

      return this.cache;
    } catch (error: any) {
      this.logger.error(`Error fetching exchange rates from Hacienda API: ${error?.message}`);

      // Intentar usar cache incluso si expiró
      if (this.cache) {
        this.logger.warn('Usando tipos de cambio cacheados (expirados)');
        return this.cache as ExchangeRateCache;
      }

      throw new Error(
        `No se pudo obtener tipos de cambio desde Hacienda API: ${error?.message}`,
      );
    }
  }
}
