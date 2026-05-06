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

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <span className="text-3xl">{icon}</span>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const branchId = useActiveBranchId();
  const settings = useSettings();

  const today = toDateInputValue(new Date());
  const monthAgo = toDateInputValue(new Date(Date.now() - 30 * 86400_000));

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

  return (
    <div className="space-y-6 pb-8">
      <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
        <StatCard label="Ventas del día" value={formatCurrency(dailySales?.totalSales ?? 0, settings)} icon="💰" />
        <StatCard label="Efectivo" value={formatCurrency(dailySales?.cashSales ?? 0, settings)} icon="💵" />
        <StatCard label="Tarjeta" value={formatCurrency(dailySales?.cardSales ?? 0, settings)} icon="💳" />
        <StatCard label="Órdenes" value={String(dailySales?.orderCount ?? 0)} icon="📋" />
        <StatCard label="Ticket promedio" value={formatCurrency(dailySales?.avgTicket ?? 0, settings)} icon="🧾" />
        <StatCard label="Impuestos" value={formatCurrency(dailySales?.totalTax ?? 0, settings)} icon="📑" />
      </div>

      {salesRange?.dailyBreakdown?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-base font-semibold text-gray-800 mb-4">Tendencia de ventas (30 días)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={salesRange.dailyBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatCurrency(Number(v || 0), settings)} />
              <Line type="monotone" dataKey="total" stroke="#f97316" name="Total" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {topProducts?.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-base font-semibold text-gray-800 mb-4">Top productos (30 días)</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topProducts} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="productName" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="totalQuantity" fill="#f97316" radius={[4, 4, 0, 0]} name="Vendidos" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {peakHours.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-base font-semibold text-gray-800 mb-4">Horas pico (30 días)</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={peakHours}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="orderCount" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {profitLoss && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-base font-semibold text-gray-800 mb-4">Resultado del periodo (30 días)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm text-emerald-700">Ventas</p>
              <p className="text-2xl font-bold text-emerald-900 mt-1">{formatCurrency(profitLoss.totalSales ?? 0, settings)}</p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700">Gastos</p>
              <p className="text-2xl font-bold text-red-900 mt-1">{formatCurrency(profitLoss.totalExpenses ?? 0, settings)}</p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm text-blue-700">Ganancia bruta</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">{formatCurrency(profitLoss.grossProfit ?? 0, settings)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
