import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { useSocket } from '../../hooks/useSocket';

// El branchId se pasa por query string: ?branchId=xxx
const params = new URLSearchParams(window.location.search);
const BRANCH_ID = params.get('branchId') ?? '';

interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  notes?: string;
  modifiers: { optionName: string }[];
}

interface Order {
  id: string;
  orderNumber: string;
  type: string;
  status: string;
  createdAt: string;
  table?: { number: number };
  items: OrderItem[];
}

function elapsed(createdAt: string): string {
  const secs = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function OrderCard({ order, onReady }: { order: Order; onReady: (id: string) => void }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const mins = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);
  const urgent = mins >= 10;

  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-3 ${urgent ? 'border-red-500 bg-red-950' : 'border-gray-700 bg-gray-800'}`}>
      <div className="flex items-center justify-between">
        <span className="text-lg font-bold">#{order.orderNumber}</span>
        <span className={`text-sm font-mono px-2 py-0.5 rounded ${urgent ? 'bg-red-600' : 'bg-gray-700'}`}>
          ⏱ {elapsed(order.createdAt)}
        </span>
      </div>

      <div className="text-xs text-gray-400 flex gap-2">
        <span className="capitalize">{order.type.toLowerCase()}</span>
        {order.table && <span>• Mesa {order.table.number}</span>}
        <span className={`px-1.5 py-0.5 rounded text-white ${order.status === 'PENDING' ? 'bg-yellow-600' : 'bg-blue-600'}`}>
          {order.status === 'PENDING' ? 'Nuevo' : 'En preparación'}
        </span>
      </div>

      <ul className="space-y-1.5">
        {order.items.map((item) => (
          <li key={item.id} className="text-sm">
            <span className="font-semibold text-white">{item.quantity}× {item.productName}</span>
            {item.modifiers?.length > 0 && (
              <div className="text-xs text-gray-400 ml-4">
                {item.modifiers.map((m, i) => <span key={i}>+ {m.optionName} </span>)}
              </div>
            )}
            {item.notes && <div className="text-xs text-yellow-400 ml-4">📝 {item.notes}</div>}
          </li>
        ))}
      </ul>

      <button
        onClick={() => onReady(order.id)}
        className="mt-auto py-2 bg-green-600 hover:bg-green-500 active:bg-green-700 rounded-lg font-semibold text-sm transition-colors"
      >
        ✅ Lista
      </button>
    </div>
  );
}

export default function App() {
  const qc = useQueryClient();

  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ['kitchen-orders', BRANCH_ID],
    queryFn: () =>
      api.get(`/kitchen/orders?branchId=${BRANCH_ID}`).then((r) => r.data),
    enabled: !!BRANCH_ID,
    refetchInterval: 15_000,
  });

  useSocket({
    branchId: BRANCH_ID,
    events: {
      'kitchen:new_order': () => qc.invalidateQueries({ queryKey: ['kitchen-orders'] }),
      'order:status_updated': () => qc.invalidateQueries({ queryKey: ['kitchen-orders'] }),
    },
    enabled: !!BRANCH_ID,
  });

  const markReady = useMutation({
    mutationFn: (id: string) => api.patch(`/orders/${id}/status`, { status: 'READY' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kitchen-orders'] }),
  });

  return (
    <div className="min-h-screen p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">🍳 Cocina — KDS</h1>
        <span className="text-sm text-gray-400">{orders.length} orden(es) pendiente(s)</span>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <span className="text-5xl mb-4">✅</span>
          <p className="text-lg">Sin órdenes pendientes</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} onReady={(id) => markReady.mutate(id)} />
          ))}
        </div>
      )}
    </div>
  );
}
