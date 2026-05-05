import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth.store';
import { useSocket } from '../../../hooks/useSocket';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  in_preparation: 'En cocina',
  ready: 'Lista',
  delivered: 'Entregada',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  in_preparation: 'bg-blue-100 text-blue-700',
  ready: 'bg-green-100 text-green-700',
  delivered: 'bg-purple-100 text-purple-700',
  completed: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-red-100 text-red-600',
};

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'in_preparation', label: 'En cocina' },
  { value: 'ready', label: 'Lista' },
  { value: 'delivered', label: 'Entregada' },
  { value: 'completed', label: 'Completada' },
  { value: 'cancelled', label: 'Cancelada' },
];

function isInDateRange(dateIso: string, fromDate: string, toDate: string): boolean {
  const createdAt = new Date(dateIso).getTime();
  if (!Number.isFinite(createdAt)) return false;

  if (fromDate) {
    const from = new Date(`${fromDate}T00:00:00`).getTime();
    if (createdAt < from) return false;
  }

  if (toDate) {
    const to = new Date(`${toDate}T23:59:59.999`).getTime();
    if (createdAt > to) return false;
  }

  return true;
}

function toDateInputValue(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function OrdersPage() {
  const { user } = useAuthStore();
  const branchId = user?.branchId ?? '';
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const { data: orders = [] } = useQuery({
    queryKey: ['orders', branchId],
    queryFn: () =>
      api.get(`/orders?branchId=${branchId}`).then((r) => r.data),
    enabled: !!branchId,
    refetchInterval: 30_000,
  });

  const filteredOrders = useMemo(() => {
    return orders.filter((o: { status: string; createdAt: string }) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      return isInDateRange(o.createdAt, fromDate, toDate);
    });
  }, [orders, statusFilter, fromDate, toDate]);

  const applyQuickDateFilter = (preset: 'today' | 'week' | 'month') => {
    const now = new Date();
    const today = toDateInputValue(now);

    if (preset === 'today') {
      setFromDate(today);
      setToDate(today);
      return;
    }

    if (preset === 'week') {
      const from = new Date(now);
      from.setDate(now.getDate() - 6);
      setFromDate(toDateInputValue(from));
      setToDate(today);
      return;
    }

    const from = new Date(now);
    from.setDate(now.getDate() - 29);
    setFromDate(toDateInputValue(from));
    setToDate(today);
  };

  useSocket({
    branchId,
    events: {
      'kitchen:new_order': () => qc.invalidateQueries({ queryKey: ['orders'] }),
      'order:status_updated': () => qc.invalidateQueries({ queryKey: ['orders'] }),
    },
    enabled: !!branchId,
  });

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Órdenes</h2>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Estado</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Desde</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Hasta</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setStatusFilter('all');
                setFromDate('');
                setToDate('');
              }}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-3 py-2 text-sm font-medium"
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => applyQuickDateFilter('today')}
            className="px-3 py-1.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100"
          >
            Hoy
          </button>
          <button
            onClick={() => applyQuickDateFilter('week')}
            className="px-3 py-1.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
          >
            Ultimos 7 dias
          </button>
          <button
            onClick={() => applyQuickDateFilter('month')}
            className="px-3 py-1.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700 hover:bg-violet-100"
          >
            Ultimos 30 dias
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['#', 'Tipo', 'Mesa', 'Estado', 'Total', 'Hora'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredOrders.map((o: {
              id: string; orderNumber: string; type: string; table?: { number: number }; status: string; total: number; createdAt: string; userId?: string | null
            }) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono font-medium">{o.orderNumber}</td>
                <td className="px-4 py-3 capitalize text-gray-600">{o.type.toLowerCase()}</td>
                <td className="px-4 py-3 text-gray-600">
                  {o.type === 'kiosk'
                    ? 'Kiosko'
                    : o.type === 'takeout'
                      ? 'Para llevar'
                      : o.type === 'delivery'
                        ? 'Delivery'
                        : o.table
                          ? `Mesa ${o.table.number}`
                          : (!o.userId ? 'Kiosko' : '—')}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[o.status] ?? ''}`}>
                    {STATUS_LABELS[o.status] ?? o.status}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium">${Number(o.total).toFixed(2)}</td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(o.createdAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredOrders.length === 0 && (
          <p className="text-center text-gray-400 py-12">No hay órdenes para mostrar.</p>
        )}
      </div>
    </div>
  );
}
