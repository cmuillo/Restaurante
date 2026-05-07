import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';
import { useActiveBranchId } from '../../../hooks/useActiveBranchId';
import { useSettings } from '../../../hooks/useSettings';
import { formatCurrency } from '../../../stores/settings.store';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

function toDateInputValue(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  const branchId = useActiveBranchId();
  const settings = useSettings();

  const today = toDateInputValue(new Date());
  const monthAgo = toDateInputValue(new Date(Date.now() - 30 * 86400_000));
  const ninetyDaysAgo = toDateInputValue(new Date(Date.now() - 90 * 86400_000));

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
