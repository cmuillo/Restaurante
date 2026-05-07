import { create } from 'zustand';

export interface GlobalSettings {
  id: string;
  restaurantName: string;
  restaurantSlogan: string | null;
  logoBase64: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  currency: string;
  currencySymbol: string;
  currencyLocale: string;
  theme: 'light' | 'dark';
  brandColor: string;
  defaultTaxRate: number;
  tipSuggestions: number[];
  invoiceFooterMessage: string | null;
  kioskWelcomeColor: string;
  kioskWelcomeColorDark: string;
  kioskWelcomeMessage: string;
  kioskWelcomeSubtitle: string;
  timezone: string;
  dateFormat: string;
  updatedAt: string;
}

const DEFAULT_SETTINGS: GlobalSettings = {
  id: 'main',
  restaurantName: 'Mi Restaurante',
  restaurantSlogan: null,
  logoBase64: null,
  phone: null,
  email: null,
  address: null,
  website: null,
  currency: 'CRC',
  currencySymbol: '₡',
  currencyLocale: 'es-CR',
  theme: 'light',
  brandColor: '#ea580c',
  defaultTaxRate: 13,
  tipSuggestions: [10, 15, 18],
  invoiceFooterMessage: null,
  kioskWelcomeColor: '#EA580C',
  kioskWelcomeColorDark: '#C2410C',
  kioskWelcomeMessage: '¡Bienvenido!',
  kioskWelcomeSubtitle: 'Toca la pantalla para comenzar tu pedido',
  timezone: 'America/Costa_Rica',
  dateFormat: 'DD/MM/YYYY',
  updatedAt: '',
};

interface SettingsState {
  settings: GlobalSettings;
  setSettings: (s: GlobalSettings) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS,
  setSettings: (settings) => set({ settings }),
}));

/** Formatea un número como moneda usando las settings globales */
export function formatCurrency(amount: number, settings: GlobalSettings): string {
  try {
    return new Intl.NumberFormat(settings.currencyLocale, {
      style: 'currency',
      currency: settings.currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${settings.currencySymbol}${amount.toFixed(2)}`;
  }
}

/**
 * Versión sin hooks — accede al store directamente (usable fuera de componentes React).
 * Ideal para funciones de impresión, utilidades, etc.
 */
export function fmtMoney(amount: number): string {
  const { settings } = useSettingsStore.getState();
  return formatCurrency(amount, settings);
}
