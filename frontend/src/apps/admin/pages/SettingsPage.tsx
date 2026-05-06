import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import type { GlobalSettings } from '../../../stores/settings.store';

const CURRENCIES = [
  { code: 'CRC', symbol: '₡', label: 'Colón costarricense (₡)', locale: 'es-CR' },
  { code: 'USD', symbol: '$', label: 'Dólar estadounidense ($)', locale: 'en-US' },
  { code: 'EUR', symbol: '€', label: 'Euro (€)', locale: 'es-ES' },
  { code: 'MXN', symbol: '$', label: 'Peso mexicano ($)', locale: 'es-MX' },
  { code: 'COP', symbol: '$', label: 'Peso colombiano ($)', locale: 'es-CO' },
  { code: 'PEN', symbol: 'S/', label: 'Sol peruano (S/)', locale: 'es-PE' },
  { code: 'CLP', symbol: '$', label: 'Peso chileno ($)', locale: 'es-CL' },
  { code: 'ARS', symbol: '$', label: 'Peso argentino ($)', locale: 'es-AR' },
  { code: 'BRL', symbol: 'R$', label: 'Real brasileño (R$)', locale: 'pt-BR' },
  { code: 'GTQ', symbol: 'Q', label: 'Quetzal guatemalteco (Q)', locale: 'es-GT' },
  { code: 'HNL', symbol: 'L', label: 'Lempira hondureño (L)', locale: 'es-HN' },
  { code: 'NIO', symbol: 'C$', label: 'Córdoba nicaragüense (C$)', locale: 'es-NI' },
  { code: 'DOP', symbol: 'RD$', label: 'Peso dominicano (RD$)', locale: 'es-DO' },
];

const TIMEZONES = [
  { value: 'America/Costa_Rica', label: 'Costa Rica (UTC-6)' },
  { value: 'America/New_York', label: 'Este de EE.UU. (UTC-5/-4)' },
  { value: 'America/Chicago', label: 'Centro de EE.UU. (UTC-6/-5)' },
  { value: 'America/Denver', label: 'Montaña EE.UU. (UTC-7/-6)' },
  { value: 'America/Los_Angeles', label: 'Pacífico EE.UU. (UTC-8/-7)' },
  { value: 'America/Mexico_City', label: 'México Centro (UTC-6/-5)' },
  { value: 'America/Bogota', label: 'Colombia (UTC-5)' },
  { value: 'America/Lima', label: 'Perú (UTC-5)' },
  { value: 'America/Santiago', label: 'Chile (UTC-4/-3)' },
  { value: 'America/Sao_Paulo', label: 'Brasil Este (UTC-3/-2)' },
  { value: 'America/Buenos_Aires', label: 'Argentina (UTC-3)' },
  { value: 'Europe/Madrid', label: 'España (UTC+1/+2)' },
];

const TABS = [
  { id: 'empresa', label: 'Empresa', icon: '🏢' },
  { id: 'apariencia', label: 'Apariencia', icon: '🎨' },
  { id: 'moneda', label: 'Moneda y Fiscal', icon: '💰' },
  { id: 'kiosko', label: 'Kiosko', icon: '🖥️' },
  { id: 'regional', label: 'Regional', icon: '🌍' },
] as const;

type TabId = typeof TABS[number]['id'];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 mt-6 first:mt-0">{children}</h3>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-500 mb-1">{hint}</p>}
      {children}
    </div>
  );
}

const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';
const SELECT = INPUT;

export default function SettingsPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>('empresa');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const logoInputRef = useRef<HTMLInputElement>(null);

  const { data: settings, isLoading } = useQuery<GlobalSettings>({
    queryKey: ['global-settings'],
    queryFn: () => api.get('/settings').then((r) => r.data),
  });

  const [form, setForm] = useState<Partial<GlobalSettings>>({});

  // Cuando llegan settings, rellenar form con los valores actuales
  const current = { ...settings, ...form } as GlobalSettings;

  const update = (field: keyof GlobalSettings, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
    setError('');
  };

  const saveMutation = useMutation({
    mutationFn: (data: Partial<GlobalSettings>) => api.patch('/settings', data).then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(['global-settings'], data);
      qc.invalidateQueries({ queryKey: ['global-settings'] });
      setForm({});
      setSaved(true);
      setError('');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' · ') : String(msg ?? 'Error al guardar'));
    },
  });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('El logo no puede superar 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => update('logoBase64', reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleTipSuggestions = (raw: string) => {
    const nums = raw.split(',').map((s) => Number(s.trim())).filter((n) => !isNaN(n) && n > 0);
    update('tipSuggestions', nums);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Cargando configuración...</div>;
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Personalización global</h2>
          <p className="text-sm text-gray-500 mt-1">Configuración general del sistema — aplica a Admin, Kiosko y Facturas</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-emerald-600 font-medium">✓ Guardado</span>}
          <button
            onClick={() => saveMutation.mutate(form)}
            disabled={saveMutation.isPending || Object.keys(form).length === 0}
            className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saveMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6">

        {/* ── EMPRESA ─────────────────────────────────────────────────────── */}
        {activeTab === 'empresa' && (
          <div>
            <SectionTitle>Identidad del negocio</SectionTitle>

            {/* Logo */}
            <Field label="Logotipo" hint="Imagen PNG, JPG o SVG. Máx 2 MB. Se mostrará en el sidebar del admin, facturas y kiosko.">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50 shrink-0">
                  {current.logoBase64
                    ? <img src={current.logoBase64} alt="Logo" className="w-full h-full object-contain" />
                    : <span className="text-3xl">🍴</span>
                  }
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Subir imagen
                  </button>
                  {current.logoBase64 && (
                    <button
                      onClick={() => update('logoBase64', null)}
                      className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Eliminar logo
                    </button>
                  )}
                </div>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              </div>
            </Field>

            <Field label="Nombre del restaurante">
              <input
                className={INPUT}
                value={current.restaurantName ?? ''}
                onChange={(e) => update('restaurantName', e.target.value)}
                placeholder="Mi Restaurante"
              />
            </Field>

            <Field label="Eslogan / descripción corta">
              <input
                className={INPUT}
                value={current.restaurantSlogan ?? ''}
                onChange={(e) => update('restaurantSlogan', e.target.value)}
                placeholder="La mejor comida de la ciudad"
              />
            </Field>

            <SectionTitle>Contacto</SectionTitle>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Teléfono">
                <input className={INPUT} value={current.phone ?? ''} onChange={(e) => update('phone', e.target.value)} placeholder="+506 2222-3333" />
              </Field>
              <Field label="Correo electrónico">
                <input className={INPUT} type="email" value={current.email ?? ''} onChange={(e) => update('email', e.target.value)} placeholder="info@restaurante.com" />
              </Field>
            </div>

            <Field label="Dirección">
              <input className={INPUT} value={current.address ?? ''} onChange={(e) => update('address', e.target.value)} placeholder="Calle 5, Avenida 2, San José" />
            </Field>

            <Field label="Sitio web">
              <input className={INPUT} value={current.website ?? ''} onChange={(e) => update('website', e.target.value)} placeholder="https://mirestaurante.com" />
            </Field>
          </div>
        )}

        {/* ── APARIENCIA ──────────────────────────────────────────────────── */}
        {activeTab === 'apariencia' && (
          <div>
            <SectionTitle>Tema del panel admin</SectionTitle>

            <Field label="Tema de color" hint="El tema oscuro aplica al panel de administración.">
              <div className="flex gap-3">
                {(['light', 'dark'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => update('theme', t)}
                    className={`flex-1 py-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                      current.theme === t
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-3xl">{t === 'light' ? '☀️' : '🌙'}</span>
                    <span className="text-sm font-medium capitalize">{t === 'light' ? 'Claro' : 'Oscuro'}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-amber-600 mt-2">⚠️ Algunos componentes de páginas específicas pueden requerir recarga para aplicar el tema.</p>
            </Field>

            <SectionTitle>Factura impresa</SectionTitle>

            <Field label="Mensaje de pie de factura" hint="Aparece al final de cada factura impresa.">
              <textarea
                className={INPUT}
                rows={3}
                value={current.invoiceFooterMessage ?? ''}
                onChange={(e) => update('invoiceFooterMessage', e.target.value)}
                placeholder="¡Gracias por su preferencia! Vuelva pronto."
              />
            </Field>
          </div>
        )}

        {/* ── MONEDA Y FISCAL ─────────────────────────────────────────────── */}
        {activeTab === 'moneda' && (
          <div>
            <SectionTitle>Moneda</SectionTitle>

            <Field label="Moneda principal" hint="Selecciona la moneda con la que opera el restaurante.">
              <select
                className={SELECT}
                value={current.currency ?? 'CRC'}
                onChange={(e) => {
                  const found = CURRENCIES.find((c) => c.code === e.target.value);
                  if (found) {
                    setForm((prev) => ({
                      ...prev,
                      currency: found.code,
                      currencySymbol: found.symbol,
                      currencyLocale: found.locale,
                    }));
                    setSaved(false);
                  }
                }}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Símbolo de moneda" hint="Ej: ₡, $, €">
                <input className={INPUT} value={current.currencySymbol ?? ''} onChange={(e) => update('currencySymbol', e.target.value)} />
              </Field>
              <Field label="Locale (formato numérico)" hint="Ej: es-CR, en-US">
                <input className={INPUT} value={current.currencyLocale ?? ''} onChange={(e) => update('currencyLocale', e.target.value)} />
              </Field>
            </div>

            {/* Vista previa */}
            <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
              Vista previa: <strong>
                {(() => {
                  try {
                    return new Intl.NumberFormat(current.currencyLocale ?? 'es-CR', {
                      style: 'currency', currency: current.currency ?? 'CRC',
                    }).format(12500.75);
                  } catch { return `${current.currencySymbol ?? '₡'}12,500.75`; }
                })()}
              </strong>
            </div>

            <SectionTitle>Impuestos y propinas</SectionTitle>

            <Field label="Tasa de impuesto por defecto (%)" hint="Costa Rica: 13%. Se aplica a nuevas sucursales.">
              <input
                className={INPUT}
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={current.defaultTaxRate ?? 13}
                onChange={(e) => update('defaultTaxRate', parseFloat(e.target.value))}
              />
            </Field>

            <Field label="Sugerencias de propina (%)" hint="Porcentajes separados por coma. Ej: 10, 15, 18">
              <input
                className={INPUT}
                value={(current.tipSuggestions ?? []).join(', ')}
                onChange={(e) => handleTipSuggestions(e.target.value)}
                placeholder="10, 15, 18"
              />
            </Field>
          </div>
        )}

        {/* ── KIOSKO ──────────────────────────────────────────────────────── */}
        {activeTab === 'kiosko' && (
          <div>
            <SectionTitle>Pantalla de bienvenida</SectionTitle>

            <Field label="Mensaje principal">
              <input
                className={INPUT}
                value={current.kioskWelcomeMessage ?? ''}
                onChange={(e) => update('kioskWelcomeMessage', e.target.value)}
                placeholder="¡Bienvenido!"
              />
            </Field>

            <Field label="Subtítulo / instrucción">
              <input
                className={INPUT}
                value={current.kioskWelcomeSubtitle ?? ''}
                onChange={(e) => update('kioskWelcomeSubtitle', e.target.value)}
                placeholder="Toca la pantalla para comenzar tu pedido"
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Color principal (fondo)">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={current.kioskWelcomeColor ?? '#EA580C'}
                    onChange={(e) => update('kioskWelcomeColor', e.target.value)}
                    className="w-12 h-10 rounded border border-gray-300 cursor-pointer p-0.5"
                  />
                  <input
                    className={INPUT}
                    value={current.kioskWelcomeColor ?? '#EA580C'}
                    onChange={(e) => update('kioskWelcomeColor', e.target.value)}
                    placeholder="#EA580C"
                  />
                </div>
              </Field>
              <Field label="Color secundario (gradiente)">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={current.kioskWelcomeColorDark ?? '#C2410C'}
                    onChange={(e) => update('kioskWelcomeColorDark', e.target.value)}
                    className="w-12 h-10 rounded border border-gray-300 cursor-pointer p-0.5"
                  />
                  <input
                    className={INPUT}
                    value={current.kioskWelcomeColorDark ?? '#C2410C'}
                    onChange={(e) => update('kioskWelcomeColorDark', e.target.value)}
                    placeholder="#C2410C"
                  />
                </div>
              </Field>
            </div>

            {/* Vista previa del kiosko */}
            <SectionTitle>Vista previa</SectionTitle>
            <div
              className="rounded-xl overflow-hidden aspect-video flex flex-col items-center justify-center cursor-pointer select-none"
              style={{
                background: `linear-gradient(135deg, ${current.kioskWelcomeColor ?? '#EA580C'}, ${current.kioskWelcomeColorDark ?? '#C2410C'})`,
              }}
            >
              {current.logoBase64
                ? <img src={current.logoBase64} alt="Logo" className="h-16 object-contain mb-4 drop-shadow-lg" />
                : <span className="text-5xl mb-4">🍴</span>
              }
              <p className="text-3xl font-black text-white mb-2">{current.kioskWelcomeMessage || '¡Bienvenido!'}</p>
              <p className="text-sm text-white/80 animate-pulse">{current.kioskWelcomeSubtitle || 'Toca la pantalla para comenzar'}</p>
            </div>
          </div>
        )}

        {/* ── REGIONAL ────────────────────────────────────────────────────── */}
        {activeTab === 'regional' && (
          <div>
            <SectionTitle>Zona horaria y formato de fechas</SectionTitle>

            <Field label="Zona horaria" hint="Afecta reportes y registros de hora.">
              <select
                className={SELECT}
                value={current.timezone ?? 'America/Costa_Rica'}
                onChange={(e) => update('timezone', e.target.value)}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Formato de fecha" hint="Cómo se muestran las fechas en la interfaz.">
              <select
                className={SELECT}
                value={current.dateFormat ?? 'DD/MM/YYYY'}
                onChange={(e) => update('dateFormat', e.target.value)}
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2025)</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2025)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (2025-12-31)</option>
                <option value="D [de] MMMM [de] YYYY">D de Mes de YYYY (31 de diciembre de 2025)</option>
              </select>
            </Field>

            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              <strong>Zona horaria actual:</strong> {current.timezone ?? 'America/Costa_Rica'}<br />
              <strong>Hora local:</strong> {new Date().toLocaleTimeString('es-CR', { timeZone: current.timezone ?? 'America/Costa_Rica' })}
            </div>
          </div>
        )}
      </div>

      {/* Botón guardar inferior */}
      {Object.keys(form).length > 0 && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => saveMutation.mutate(form)}
            disabled={saveMutation.isPending}
            className="px-6 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {saveMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      )}
    </div>
  );
}
