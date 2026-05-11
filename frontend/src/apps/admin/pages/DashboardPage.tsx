import { useQueries, useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';
import { useActiveBranchId } from '../../../hooks/useActiveBranchId';
import { useSettings } from '../../../hooks/useSettings';
import { formatCurrency } from '../../../stores/settings.store';
import { useAuthStore } from '../../../stores/auth.store';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

type Branch = { id: string; name: string; isActive: boolean };
type DayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
type BusinessHours = Record<DayKey, { open: string; close: string; closed: boolean }>;
type BranchConfig = { id: string; branchId: string; businessHours?: Partial<BusinessHours> | null };
type DailySales = {
  orderCount: number;
  totalSales: number;
  avgTicket: number;
  totalTax: number;
  totalTip: number;
  totalDiscount: number;
  pointsDiscount: number;
  cashSales: number;
  cardSales: number;
};

type ShiftCurrent = {
  id: string;
  status: string;
  openedAt: string;
  openingCash: number;
  openedBy?: { name?: string };
} | null;

type AlertType = 'critical' | 'warning' | 'ok';
type OperationalAlert = {
  branchId: string;
  branchName: string;
  type: AlertType;
  icon: string;
  title: string;
  message: string;
  details?: string;
};

const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  monday: { open: '06:00', close: '22:00', closed: false },
  tuesday: { open: '06:00', close: '22:00', closed: false },
  wednesday: { open: '06:00', close: '22:00', closed: false },
  thursday: { open: '06:00', close: '22:00', closed: false },
  friday: { open: '06:00', close: '22:00', closed: false },
  saturday: { open: '06:00', close: '22:00', closed: false },
  sunday: { open: '06:00', close: '22:00', closed: false },
};

function mergeBusinessHours(input?: Partial<BusinessHours> | null): BusinessHours {
  return {
    monday: { ...DEFAULT_BUSINESS_HOURS.monday, ...(input?.monday ?? {}) },
    tuesday: { ...DEFAULT_BUSINESS_HOURS.tuesday, ...(input?.tuesday ?? {}) },
    wednesday: { ...DEFAULT_BUSINESS_HOURS.wednesday, ...(input?.wednesday ?? {}) },
    thursday: { ...DEFAULT_BUSINESS_HOURS.thursday, ...(input?.thursday ?? {}) },
    friday: { ...DEFAULT_BUSINESS_HOURS.friday, ...(input?.friday ?? {}) },
    saturday: { ...DEFAULT_BUSINESS_HOURS.saturday, ...(input?.saturday ?? {}) },
    sunday: { ...DEFAULT_BUSINESS_HOURS.sunday, ...(input?.sunday ?? {}) },
  };
}

function dayKeyFromDate(date: Date): DayKey {
  const map: DayKey[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return map[date.getDay()];
}

function timeToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function isWithinOperatingHours(hours: BusinessHours, now: Date): boolean {
  const key = dayKeyFromDate(now);
  const cfg = hours[key];
  if (!cfg || cfg.closed) return false;

  const open = timeToMinutes(cfg.open);
  const close = timeToMinutes(cfg.close);
  const current = now.getHours() * 60 + now.getMinutes();

  if (open === close) return true;
  if (open < close) return current >= open && current < close;
  return current >= open || current < close;
}

function getTodayScheduleLabel(hours: BusinessHours, now: Date): string {
  const key = dayKeyFromDate(now);
  const cfg = hours[key];
  if (!cfg || cfg.closed) return 'Cerrado';
  return `${cfg.open} - ${cfg.close}`;
}

function toDateInputValue(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calculateAlerts(
  globalRows: Array<{ branchId: string; branchName: string; daily: DailySales | null; shift: ShiftCurrent; isShiftOpen: boolean; businessHours: BusinessHours }>,
): OperationalAlert[] {
  const alerts: OperationalAlert[] = [];
  const now = new Date();

  for (const row of globalRows) {
    const isOperatingHours = isWithinOperatingHours(row.businessHours, now);
    const scheduleLabel = getTodayScheduleLabel(row.businessHours, now);

    // Alerta 1: Caja cerrada en horario operativo
    if (isOperatingHours && !row.isShiftOpen) {
      alerts.push({
        branchId: row.branchId,
        branchName: row.branchName,
        type: 'critical',
        icon: '🔴',
        title: 'Caja cerrada en horario',
        message: `Necesita apertura inmediata. Hora actual: ${now.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}`,
        details: `Estado: Cerrada | Horario hoy: ${scheduleLabel}`,
      });
      continue;
    }

    // Alerta 2: Pocas órdenes en la última hora (posible caída de pedidos)
    const orderThreshold = 2;
    if ((row.daily?.orderCount ?? 0) < orderThreshold && isOperatingHours && row.isShiftOpen) {
      alerts.push({
        branchId: row.branchId,
        branchName: row.branchName,
        type: 'warning',
        icon: '🟡',
        title: 'Caída de pedidos detectada',
        message: `Solo ${row.daily?.orderCount ?? 0} órdenes hoy. Revisar estado de sistemas.`,
        details: `Ventas: ${row.daily?.totalSales ?? 0} | Ticket: ${row.daily?.avgTicket ?? 0} | Horario hoy: ${scheduleLabel}`,
      });
      continue;
    }

    // Alerta 3: Todo está bien
    alerts.push({
      branchId: row.branchId,
      branchName: row.branchName,
      type: 'ok',
      icon: '🟢',
      title: 'Operaciones normales',
      message: `${row.daily?.orderCount ?? 0} órdenes | Caja ${row.isShiftOpen ? 'abierta' : 'cerrada'}`,
      details: `Ventas: ${row.daily?.totalSales ?? 0} | Ticket: ${row.daily?.avgTicket ?? 0} | Horario hoy: ${scheduleLabel}`,
    });
  }

  return alerts;
}

const CARD_COLORS: Record<string, { bg: string; border: string; label: string; value: string; icon: string }> = {
  amber:  { bg: 'bg-amber-50  dark:bg-amber-500/15',  border: 'border-amber-200  dark:border-amber-500/30',  label: 'text-amber-700  dark:text-amber-300',  value: 'text-amber-900  dark:text-amber-100',  icon: 'bg-amber-100  dark:bg-amber-500/20' },
  green:  { bg: 'bg-green-50  dark:bg-green-500/15',  border: 'border-green-200  dark:border-green-500/30',  label: 'text-green-700  dark:text-green-300',  value: 'text-green-900  dark:text-green-100',  icon: 'bg-green-100  dark:bg-green-500/20' },
  blue:   { bg: 'bg-blue-50   dark:bg-blue-500/15',   border: 'border-blue-200   dark:border-blue-500/30',   label: 'text-blue-700   dark:text-blue-300',   value: 'text-blue-900   dark:text-blue-100',   icon: 'bg-blue-100   dark:bg-blue-500/20' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-500/15', border: 'border-purple-200 dark:border-purple-500/30', label: 'text-purple-700 dark:text-purple-300', value: 'text-purple-900 dark:text-purple-100', icon: 'bg-purple-100 dark:bg-purple-500/20' },
  indigo: { bg: 'bg-indigo-50 dark:bg-indigo-500/15', border: 'border-indigo-200 dark:border-indigo-500/30', label: 'text-indigo-700 dark:text-indigo-300', value: 'text-indigo-900 dark:text-indigo-100', icon: 'bg-indigo-100 dark:bg-indigo-500/20' },
  slate:  { bg: 'bg-slate-50  dark:bg-slate-500/15',  border: 'border-slate-200  dark:border-slate-500/30',  label: 'text-slate-600  dark:text-slate-300',  value: 'text-slate-800  dark:text-slate-100',  icon: 'bg-slate-100  dark:bg-slate-500/20' },
  rose:   { bg: 'bg-rose-50   dark:bg-rose-500/15',   border: 'border-rose-200   dark:border-rose-500/30',   label: 'text-rose-700   dark:text-rose-300',   value: 'text-rose-900   dark:text-rose-100',   icon: 'bg-rose-100   dark:bg-rose-500/20' },
};

function StatCard({ label, value, icon, color = 'slate' }: { label: string; value: string; icon: string; color?: string }) {
  const c = CARD_COLORS[color] ?? CARD_COLORS.slate;
  return (
    <div className={`${c.bg} ${c.border} rounded-xl border p-4 flex items-center gap-3`}>
      <div className={`${c.icon} rounded-lg p-2 text-2xl flex-shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <p className={`text-xs font-medium ${c.label} truncate`}>{label}</p>
        <p className={`text-xl font-bold ${c.value} mt-0.5 truncate`}>{value}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin';
  const branchId = useActiveBranchId();
  const settings = useSettings();

  const today = toDateInputValue(new Date());
  const monthAgo = toDateInputValue(new Date(Date.now() - 30 * 86400_000));
  const ninetyDaysAgo = toDateInputValue(new Date(Date.now() - 90 * 86400_000));

  const {
    data: allBranches = [],
    isLoading: allBranchesLoading,
  } = useQuery<Branch[]>({
    queryKey: ['dashboard-global-branches'],
    queryFn: () => api.get('/branches?includeInactive=true').then((r) => r.data),
    enabled: isSuperAdmin,
    staleTime: 5 * 60_000,
  });

  const activeBranches = allBranches.filter((b) => b.isActive);

  const globalDailyQueries = useQueries({
    queries: activeBranches.map((b) => ({
      queryKey: ['dashboard-global-daily-sales', b.id, today],
      queryFn: () => api.get(`/reports/daily-sales?branchId=${b.id}&date=${today}`).then((r) => r.data as DailySales),
      enabled: isSuperAdmin,
      refetchInterval: 30_000,
    })),
  });

  const globalShiftQueries = useQueries({
    queries: activeBranches.map((b) => ({
      queryKey: ['dashboard-global-current-shift', b.id],
      queryFn: () => api.get(`/pos/shift/current?branchId=${b.id}`).then((r) => r.data as ShiftCurrent).catch(() => null),
      enabled: isSuperAdmin,
      refetchInterval: 30_000,
    })),
  });

  const globalConfigQueries = useQueries({
    queries: activeBranches.map((b) => ({
      queryKey: ['dashboard-global-branch-config', b.id],
      queryFn: () => api.get(`/branches/${b.id}/config`).then((r) => r.data as BranchConfig),
      enabled: isSuperAdmin,
      staleTime: 5 * 60_000,
    })),
  });

  const globalRows = activeBranches.map((b, idx) => {
    const daily = (globalDailyQueries[idx]?.data ?? null) as DailySales | null;
    const shift = (globalShiftQueries[idx]?.data ?? null) as ShiftCurrent;
    const config = (globalConfigQueries[idx]?.data ?? null) as BranchConfig | null;
    return {
      branchId: b.id,
      branchName: b.name,
      daily,
      shift,
      isShiftOpen: !!shift,
      businessHours: mergeBusinessHours(config?.businessHours),
    };
  });

  const globalTotals = globalRows.reduce(
    (acc, row) => ({
      branches: acc.branches + 1,
      withOpenShift: acc.withOpenShift + (row.isShiftOpen ? 1 : 0),
      totalSales: acc.totalSales + (row.daily?.totalSales ?? 0),
      totalOrders: acc.totalOrders + (row.daily?.orderCount ?? 0),
    }),
    { branches: 0, withOpenShift: 0, totalSales: 0, totalOrders: 0 },
  );

  const globalAvgTicket =
    globalTotals.totalOrders > 0 ? globalTotals.totalSales / globalTotals.totalOrders : 0;

  const globalLoading =
    isSuperAdmin &&
    (
      allBranchesLoading
      || globalDailyQueries.some((q) => q.isLoading)
      || globalShiftQueries.some((q) => q.isLoading)
      || globalConfigQueries.some((q) => q.isLoading)
    );

  const { data: dailySales } = useQuery({
    queryKey: ['daily-sales', branchId, today],
    queryFn: () =>
      api.get(`/reports/daily-sales?branchId=${branchId}&date=${today}`).then((r) => r.data),
    enabled: !!branchId,
  });

  const { data: topProducts } = useQuery({
    queryKey: ['top-products', branchId, monthAgo, today],
    queryFn: () =>
      api
        .get(`/reports/top-products?branchId=${branchId}&from=${monthAgo}&to=${today}&limit=6`)
        .then((r) => r.data),
    enabled: !!branchId,
  });

  const { data: salesRange } = useQuery({
    queryKey: ['sales-range-dashboard', branchId, monthAgo, today],
    queryFn: () =>
      api.get(`/reports/sales-by-range?branchId=${branchId}&from=${monthAgo}&to=${today}`).then((r) => r.data),
    enabled: !!branchId,
  });

  const { data: peakHours = [] } = useQuery({
    queryKey: ['peak-hours-dashboard', branchId, monthAgo, today],
    queryFn: () =>
      api.get(`/reports/peak-hours?branchId=${branchId}&from=${monthAgo}&to=${today}`).then((r) => r.data),
    enabled: !!branchId,
  });

  const { data: profitLoss } = useQuery({
    queryKey: ['profit-loss-dashboard', branchId, monthAgo, today],
    queryFn: () =>
      api.get(`/reports/profit-loss?branchId=${branchId}&from=${monthAgo}&to=${today}`).then((r) => r.data),
    enabled: !!branchId,
  });

  const { data: topCustomers90d = [] } = useQuery<{ customerId: string; customerName: string; customerCode?: string; purchaseCount: number; totalSpent: number }[]>({
    queryKey: ['top-customers-dashboard', branchId, ninetyDaysAgo, today],
    queryFn: () =>
      api
        .get(`/reports/top-customers?branchId=${branchId}&from=${ninetyDaysAgo}&to=${today}&limit=3`)
        .then((r) => r.data),
    enabled: !!branchId,
  });

  if (!branchId) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h2>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          Selecciona una sucursal para cargar los indicadores del Dashboard.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h2>

      {isSuperAdmin && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 dark:bg-white/5 dark:border-white/10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Vista global multi-sucursal (hoy)</h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">Actualización automática cada 30s</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Sucursales activas" value={String(globalTotals.branches)} icon="🏢" color="slate" />
            <StatCard label="Cajas abiertas" value={String(globalTotals.withOpenShift)} icon="🟢" color="green" />
            <StatCard label="Ventas red" value={formatCurrency(globalTotals.totalSales, settings)} icon="🌐" color="blue" />
            <StatCard label="Ticket promedio red" value={formatCurrency(globalAvgTicket, settings)} icon="🧾" color="indigo" />
          </div>

          {globalLoading ? (
            <div className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 dark:border-white/15 dark:text-gray-400">
              Cargando estado global de sucursales...
            </div>
          ) : globalRows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 dark:border-white/15 dark:text-gray-400">
              No hay sucursales activas para mostrar.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-white/10">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-white/10 text-sm">
                  <thead className="bg-gray-50 dark:bg-white/5">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      <th className="px-3 py-2">Sucursal</th>
                      <th className="px-3 py-2">Caja</th>
                      <th className="px-3 py-2">Ventas día</th>
                      <th className="px-3 py-2">Órdenes día</th>
                      <th className="px-3 py-2">Ticket prom.</th>
                      <th className="px-3 py-2">Última apertura</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {globalRows
                      .sort((a, b) => (b.daily?.totalSales ?? 0) - (a.daily?.totalSales ?? 0))
                      .map((row) => (
                        <tr key={row.branchId} className="bg-white dark:bg-transparent">
                          <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{row.branchName}</td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                row.isShiftOpen
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                                  : 'bg-gray-100 text-gray-700 dark:bg-slate-700/30 dark:text-slate-300'
                              }`}
                            >
                              {row.isShiftOpen ? 'Abierta' : 'Cerrada'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{formatCurrency(row.daily?.totalSales ?? 0, settings)}</td>
                          <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{row.daily?.orderCount ?? 0}</td>
                          <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{formatCurrency(row.daily?.avgTicket ?? 0, settings)}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                            {row.shift?.openedAt ? new Date(row.shift.openedAt).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Alertas operativas por sucursal */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Alertas operativas</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {calculateAlerts(globalRows).map((alert) => {
                    const bgColor =
                      alert.type === 'critical' ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30'
                        : alert.type === 'warning' ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30'
                          : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30';
                    const textColor =
                      alert.type === 'critical' ? 'text-red-900 dark:text-red-200'
                        : alert.type === 'warning' ? 'text-amber-900 dark:text-amber-200'
                          : 'text-emerald-900 dark:text-emerald-200';
                    const titleColor =
                      alert.type === 'critical' ? 'text-red-800 dark:text-red-300'
                        : alert.type === 'warning' ? 'text-amber-800 dark:text-amber-300'
                          : 'text-emerald-800 dark:text-emerald-300';

                    return (
                      <div key={`${alert.branchId}-${alert.type}`} className={`rounded-lg border p-3 ${bgColor}`}>
                        <div className="flex items-start gap-2">
                          <span className="text-lg flex-shrink-0">{alert.icon}</span>
                          <div className="min-w-0 flex-1">
                            <p className={`text-xs font-semibold ${titleColor}`}>{alert.branchName}</p>
                            <p className={`text-sm font-medium ${textColor} mt-0.5`}>{alert.title}</p>
                            <p className={`text-xs ${textColor} opacity-90 mt-1`}>{alert.message}</p>
                            {alert.details && <p className={`text-xs ${textColor} opacity-75 mt-1`}>{alert.details}</p>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 gap-3">
        <StatCard label="Ventas del día"    value={formatCurrency(dailySales?.totalSales ?? 0, settings)}   icon="💰" color="amber" />
        <StatCard label="Efectivo"          value={formatCurrency(dailySales?.cashSales ?? 0, settings)}    icon="💵" color="green" />
        <StatCard label="Tarjeta"           value={formatCurrency(dailySales?.cardSales ?? 0, settings)}    icon="💳" color="blue" />
        <StatCard label="Órdenes"           value={String(dailySales?.orderCount ?? 0)}                     icon="📋" color="purple" />
        <StatCard label="Ticket promedio"   value={formatCurrency(dailySales?.avgTicket ?? 0, settings)}    icon="🧾" color="indigo" />
        <StatCard label="Impuestos"         value={formatCurrency(dailySales?.totalTax ?? 0, settings)}     icon="📑" color="slate" />
        <StatCard label="Desc. puntos (día)" value={formatCurrency(dailySales?.pointsDiscount ?? 0, settings)} icon="🎯" color="rose" />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 dark:bg-white/5 dark:border-white/10">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-200 mb-4">Puntos en el periodo (30 días)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-500/30 dark:bg-blue-500/15">
            <p className="text-xs font-medium text-blue-700 dark:text-blue-300">Descuento total por puntos</p>
            <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">{formatCurrency(salesRange?.pointsDiscount ?? 0, settings)}</p>
          </div>
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-500/30 dark:bg-purple-500/15">
            <p className="text-xs font-medium text-purple-700 dark:text-purple-300">Facturas con puntos</p>
            <p className="text-2xl font-bold text-purple-900 dark:text-purple-100 mt-1">
              {salesRange?.invoicesWithPoints ?? 0}
            </p>
          </div>
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/30 dark:bg-rose-500/15">
            <p className="text-xs font-medium text-rose-700 dark:text-rose-300">Promedio desc./factura</p>
            <p className="text-2xl font-bold text-rose-900 dark:text-rose-100 mt-1">
              {formatCurrency(
                (salesRange?.invoicesWithPoints ?? 0) > 0
                  ? (salesRange?.pointsDiscount ?? 0) / (salesRange?.invoicesWithPoints ?? 1)
                  : 0,
                settings,
              )}
            </p>
          </div>
        </div>
      </div>

      {salesRange?.dailyBreakdown?.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 dark:bg-white/5 dark:border-white/10">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-200 mb-4">Tendencia de ventas (30 días)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={salesRange.dailyBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke={settings.theme === 'dark' ? '#ffffff18' : '#e5e7eb'} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip formatter={(v: number) => formatCurrency(Number(v || 0), settings)} contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8, color: '#f3f4f6' }} />
              <Line type="monotone" dataKey="total" stroke="#f97316" name="Total" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {topProducts?.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 dark:bg-white/5 dark:border-white/10">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-200 mb-4">Top productos (30 días)</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topProducts} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={settings.theme === 'dark' ? '#ffffff18' : '#e5e7eb'} />
                <XAxis dataKey="productName" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8, color: '#f3f4f6' }} />
                <Bar dataKey="totalQuantity" fill="#f97316" radius={[4, 4, 0, 0]} name="Vendidos" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {peakHours.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 dark:bg-white/5 dark:border-white/10">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-200 mb-4">Horas pico (30 días)</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={peakHours}>
                <CartesianGrid strokeDasharray="3 3" stroke={settings.theme === 'dark' ? '#ffffff18' : '#e5e7eb'} />
                <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8, color: '#f3f4f6' }} />
                <Bar dataKey="orderCount" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 dark:bg-white/5 dark:border-white/10">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-200 mb-4">Top 3 clientes con más compras (90 días)</h3>
        {topCustomers90d.length > 0 ? (
          <div className="space-y-3">
            {topCustomers90d.map((c, idx) => {
              const medalColors = ['bg-amber-500/20 border-amber-500/30 text-amber-300', 'bg-slate-500/20 border-slate-500/30 text-slate-300', 'bg-orange-700/20 border-orange-700/30 text-orange-400'];
              return (
                <div key={c.customerId} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-7 h-7 rounded-full border text-xs font-bold flex items-center justify-center flex-shrink-0 ${medalColors[idx]}`}>#{idx + 1}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{c.customerName}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{c.customerCode || 'Sin código'} · {c.purchaseCount} compra(s)</p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-300 whitespace-nowrap">{formatCurrency(c.totalSpent, settings)}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-400">Sin compras de clientes registrados en los últimos 90 días.</p>
        )}
      </div>

      {profitLoss && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 dark:bg-white/5 dark:border-white/10">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-200 mb-4">Resultado del periodo (30 días)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/15">
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Ventas</p>
              <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 mt-1">{formatCurrency(profitLoss.totalSales ?? 0, settings)}</p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/15">
              <p className="text-xs font-medium text-red-700 dark:text-red-300">Gastos</p>
              <p className="text-2xl font-bold text-red-900 dark:text-red-100 mt-1">{formatCurrency(profitLoss.totalExpenses ?? 0, settings)}</p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-500/30 dark:bg-blue-500/15">
              <p className="text-xs font-medium text-blue-700 dark:text-blue-300">Ganancia bruta</p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">{formatCurrency(profitLoss.grossProfit ?? 0, settings)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
