import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth.store';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

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
  const { user } = useAuthStore();
  const branchId = user?.branchId ?? '';

  const today = new Date().toISOString().split('T')[0];
  const { data: dailySales } = useQuery({
    queryKey: ['daily-sales', branchId, today],
    queryFn: () =>
      api.get(`/reports/daily-sales?branchId=${branchId}&date=${today}`).then((r) => r.data),
    enabled: !!branchId,
  });

  const { data: topProducts } = useQuery({
    queryKey: ['top-products', branchId],
    queryFn: () =>
      api
        .get(`/reports/top-products?branchId=${branchId}&from=${today}&to=${today}&limit=5`)
        .then((r) => r.data),
    enabled: !!branchId,
  });

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Ventas del día" value={`$${dailySales?.totalSales ?? 0}`} icon="💰" />
        <StatCard label="Órdenes" value={dailySales?.orderCount ?? '—'} icon="📋" />
        <StatCard label="Ticket promedio" value={`$${dailySales?.avgTicket ?? 0}`} icon="🧾" />
        <StatCard label="Impuestos" value={`$${dailySales?.totalTax ?? 0}`} icon="📑" />
      </div>

      {topProducts?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-base font-semibold text-gray-800 mb-4">Top productos del día</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={topProducts} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="productName" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="totalQuantity" fill="#f97316" radius={[4, 4, 0, 0]} name="Vendidos" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
