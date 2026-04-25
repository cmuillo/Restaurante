import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth.store';
import { useSocket } from '../../../hooks/useSocket';

const STATUS_COLORS: Record<string, string> = {
  FREE: 'bg-green-100 text-green-700',
  OCCUPIED: 'bg-red-100 text-red-700',
  WAITING_FOOD: 'bg-yellow-100 text-yellow-700',
  BILL_REQUESTED: 'bg-orange-100 text-orange-700',
  RESERVED: 'bg-blue-100 text-blue-700',
};

const STATUS_LABELS: Record<string, string> = {
  FREE: 'Libre',
  OCCUPIED: 'Ocupada',
  WAITING_FOOD: 'Esperando comida',
  BILL_REQUESTED: 'Pide la cuenta',
  RESERVED: 'Reservada',
};

export default function TablesPage() {
  const { user } = useAuthStore();
  const branchId = user?.branchId ?? '';
  const qc = useQueryClient();

  const { data: tables = [] } = useQuery({
    queryKey: ['tables', branchId],
    queryFn: () => api.get(`/tables?branchId=${branchId}`).then((r) => r.data),
    enabled: !!branchId,
  });

  // Actualización en tiempo real
  useSocket({
    branchId,
    events: {
      'order:status_updated': () => qc.invalidateQueries({ queryKey: ['tables'] }),
    },
    enabled: !!branchId,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/tables/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tables'] }),
  });

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Mesas</h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {tables.map((t: { id: string; number: number; name?: string; capacity: number; status: string }) => (
          <div
            key={t.id}
            className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-bold text-gray-900">Mesa {t.number}</span>
              <span className="text-xs">👥 {t.capacity}</span>
            </div>
            {t.name && <p className="text-xs text-gray-400 mb-2">{t.name}</p>}
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[t.status] ?? 'bg-gray-100 text-gray-500'}`}>
              {STATUS_LABELS[t.status] ?? t.status}
            </span>

            {t.status === 'OCCUPIED' && (
              <button
                className="mt-3 w-full text-xs py-1 border border-orange-300 text-orange-600 rounded-lg hover:bg-orange-50 transition-colors"
                onClick={() => updateStatus.mutate({ id: t.id, status: 'BILL_REQUESTED' })}
              >
                Pedir cuenta
              </button>
            )}
            {(t.status === 'BILL_REQUESTED' || t.status === 'WAITING_FOOD') && (
              <button
                className="mt-3 w-full text-xs py-1 border border-green-300 text-green-600 rounded-lg hover:bg-green-50 transition-colors"
                onClick={() => updateStatus.mutate({ id: t.id, status: 'FREE' })}
              >
                Liberar mesa
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
