import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth.store';
import { useSocket } from '../../../hooks/useSocket';
import { useQueryClient } from '@tanstack/react-query';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  IN_PREPARATION: 'En cocina',
  READY: 'Lista',
  DELIVERED: 'Entregada',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  IN_PREPARATION: 'bg-blue-100 text-blue-700',
  READY: 'bg-green-100 text-green-700',
  DELIVERED: 'bg-purple-100 text-purple-700',
  COMPLETED: 'bg-gray-100 text-gray-500',
  CANCELLED: 'bg-red-100 text-red-600',
};

export default function OrdersPage() {
  const { user } = useAuthStore();
  const branchId = user?.branchId ?? '';
  const qc = useQueryClient();

  const { data: orders = [] } = useQuery({
    queryKey: ['orders', branchId],
    queryFn: () =>
      api.get(`/orders?branchId=${branchId}&limit=50`).then((r) => r.data),
    enabled: !!branchId,
    refetchInterval: 30_000,
  });

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
            {orders.map((o: {
              id: string; orderNumber: string; type: string; table?: { number: number }; status: string; total: number; createdAt: string
            }) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono font-medium">{o.orderNumber}</td>
                <td className="px-4 py-3 capitalize text-gray-600">{o.type.toLowerCase()}</td>
                <td className="px-4 py-3 text-gray-600">{o.table ? `Mesa ${o.table.number}` : '—'}</td>
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
        {orders.length === 0 && (
          <p className="text-center text-gray-400 py-12">No hay órdenes para mostrar.</p>
        )}
      </div>
    </div>
  );
}
