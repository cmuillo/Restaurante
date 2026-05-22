import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import waiterApi from '../lib/waiter-api';
import { useWaiterStore, type WaiterTable } from '../store/waiter.store';
import { useSettings } from '../../../hooks/useSettings';

const STATUS_LABELS: Record<string, string> = {
  free: 'Libre',
  occupied: 'Ocupada',
  waiting_food: 'Esperando',
  bill_requested: 'Cuenta',
  paid: 'Pagada',
  reserved: 'Reservada',
};

const STATUS_CARD: Record<string, string> = {
  free: 'border-green-400 bg-green-50',
  occupied: 'border-yellow-400 bg-yellow-50',
  waiting_food: 'border-orange-400 bg-orange-50',
  bill_requested: 'border-blue-400 bg-blue-50',
  paid: 'border-purple-400 bg-purple-50',
  reserved: 'border-gray-300 bg-gray-100',
};

const STATUS_BADGE: Record<string, string> = {
  free: 'bg-green-100 text-green-700',
  occupied: 'bg-yellow-100 text-yellow-700',
  waiting_food: 'bg-orange-100 text-orange-700',
  bill_requested: 'bg-blue-100 text-blue-700',
  paid: 'bg-purple-100 text-purple-700',
  reserved: 'bg-gray-200 text-gray-600',
};

type SheetData = {
  table: WaiterTable;
} | null;

export default function TablesScreen() {
  const { user, goTo, selectTable, setOrderType, logout } = useWaiterStore();
  const settings = useSettings();
  const branchId = user?.branchId ?? '';
  const [sheet, setSheet] = useState<SheetData>(null);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const { data: tables = [], refetch, isFetching } = useQuery<WaiterTable[]>({
    queryKey: ['waiter-tables', branchId],
    queryFn: () =>
      waiterApi.get(`/waiter/${branchId}/tables`).then((r) => r.data),
    enabled: !!branchId,
    refetchInterval: 30_000,
  });

  const { data: kitchenStats } = useQuery<{
    inQueue: number;
    inPreparation: number;
    avgPrepMinutes: number;
    avgCycleMinutes: number;
  }>({
    queryKey: ['waiter-kitchen-stats', branchId],
    queryFn: () =>
      waiterApi.get(`/waiter/${branchId}/kitchen-stats`).then((r) => r.data),
    enabled: !!branchId,
    refetchInterval: 30_000,
  });

  const requestBillMutation = useMutation({
    mutationFn: (tableId: string) =>
      waiterApi.patch(`/waiter/tables/${tableId}/request-bill?branchId=${branchId}`),
    onSuccess: () => {
      showToast('¡Cuenta solicitada al cajero!');
      setSheet(null);
      refetch();
    },
  });

  const releaseMutation = useMutation({
    mutationFn: (tableId: string) =>
      waiterApi.patch(`/waiter/tables/${tableId}/release?branchId=${branchId}`),
    onSuccess: () => {
      showToast('Mesa liberada');
      setSheet(null);
      refetch();
    },
  });

  const handleTableTap = (table: WaiterTable) => {
    if (table.status === 'reserved') return;
    if (table.status === 'free') {
      selectTable(table);
      goTo('CUSTOMER');
      return;
    }
    setSheet({ table });
  };

  const handleNewOrder = () => {
    if (!sheet) return;
    selectTable(sheet.table);
    setSheet(null);
    goTo('CUSTOMER');
  };

  const handleTakeaway = () => {
    setOrderType('takeout');
    selectTable({ id: '', number: 0, name: null, capacity: 0, status: 'free' });
    goTo('CUSTOMER');
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-2">
          {settings.logoBase64 ? (
            <img src={settings.logoBase64} alt="" className="h-8 object-contain" />
          ) : (
            <span className="text-2xl">🍽️</span>
          )}
          <div>
            <p className="text-xs text-gray-500 leading-none">Mesero</p>
            <p className="text-sm font-bold text-gray-900 leading-tight">{user?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 active:scale-95 transition-all"
          >
            {isFetching ? '⏳' : '🔄'}
          </button>
          <button
            onClick={handleTakeaway}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 text-white rounded-xl text-sm font-semibold active:scale-95 transition-all"
          >
            🛍️ Para llevar
          </button>
          <button
            onClick={logout}
            className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 active:scale-95 transition-all text-sm"
          >
            🚪
          </button>
        </div>
      </div>

      {/* Grid de mesas */}
      <div className="flex-1 overflow-y-auto p-4">
        <h2 className="text-lg font-bold text-gray-800 mb-3">Mesas</h2>
        {tables.length === 0 ? (
          <p className="text-center text-gray-400 mt-16 text-base">
            No hay mesas configuradas
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {tables.map((table) => (
              <button
                key={table.id}
                onClick={() => handleTableTap(table)}
                disabled={table.status === 'reserved'}
                className={`relative flex flex-col items-center justify-center rounded-2xl border-2 p-4 gap-1 min-h-[110px] transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${STATUS_CARD[table.status] ?? 'border-gray-200 bg-white'}`}
              >
                <span className="text-3xl font-black text-gray-800">{table.number}</span>
                {table.name && (
                  <span className="text-xs text-gray-500 text-center leading-tight">
                    {table.name}
                  </span>
                )}
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  👥 {table.capacity}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold mt-1 ${STATUS_BADGE[table.status] ?? 'bg-gray-100 text-gray-600'}`}
                >
                  {STATUS_LABELS[table.status] ?? table.status}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Kitchen Stats */}
      {kitchenStats !== undefined && (
        <div className="px-4 pb-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Estado de Cocina</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-xl font-black text-orange-500">{kitchenStats.inQueue}</span>
                <span className="text-[10px] text-gray-500 leading-tight">En cola</span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-xl font-black text-blue-500">{kitchenStats.inPreparation}</span>
                <span className="text-[10px] text-gray-500 leading-tight">Preparando</span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-xl font-black text-green-600">
                  {kitchenStats.avgPrepMinutes > 0 ? `${kitchenStats.avgPrepMinutes}m` : '--'}
                </span>
                <span className="text-[10px] text-gray-500 leading-tight">Prom. prep.</span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-xl font-black text-purple-600">
                  {kitchenStats.avgCycleMinutes > 0 ? `${kitchenStats.avgCycleMinutes}m` : '--'}
                </span>
                <span className="text-[10px] text-gray-500 leading-tight">Ciclo cocina</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom sheet para mesa ocupada */}
      {sheet && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          onClick={() => setSheet(null)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white rounded-t-3xl p-6 flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-2" />
            <h3 className="text-lg font-bold text-gray-900 text-center">
              Mesa {sheet.table.number}
              {sheet.table.name ? ` · ${sheet.table.name}` : ''}
            </h3>
            <p className="text-xs text-center font-semibold px-2 py-1 rounded-full w-fit mx-auto
              {STATUS_BADGE[sheet.table.status] ?? 'bg-gray-100 text-gray-600'}">
              {STATUS_LABELS[sheet.table.status] ?? sheet.table.status}
            </p>

            {/* Acciones según estado */}
            {sheet.table.status === 'paid' ? (
              <>
                <button
                  onClick={() => releaseMutation.mutate(sheet.table.id)}
                  disabled={releaseMutation.isPending}
                  className="w-full bg-green-600 hover:bg-green-500 active:scale-95 text-white font-bold rounded-2xl py-4 text-base transition-all disabled:opacity-50"
                >
                  🔓 Liberar mesa
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleNewOrder}
                  className="w-full bg-brand-600 hover:bg-brand-500 active:scale-95 text-white font-bold rounded-2xl py-4 text-base transition-all"
                >
                  ➕ Nueva orden
                </button>
                {sheet.table.status !== 'bill_requested' && (
                  <button
                    onClick={() => requestBillMutation.mutate(sheet.table.id)}
                    disabled={requestBillMutation.isPending}
                    className="w-full bg-blue-50 hover:bg-blue-100 active:scale-95 text-blue-700 font-bold rounded-2xl py-4 text-base transition-all disabled:opacity-50"
                  >
                    🧾 Solicitar cuenta
                  </button>
                )}
              </>
            )}

            <button
              onClick={() => setSheet(null)}
              className="w-full bg-gray-100 text-gray-600 font-semibold rounded-2xl py-3 text-base"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
