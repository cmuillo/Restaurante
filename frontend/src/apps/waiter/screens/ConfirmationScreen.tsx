import { useMutation } from '@tanstack/react-query';
import waiterApi from '../lib/waiter-api';
import { useWaiterStore } from '../store/waiter.store';

export default function ConfirmationScreen() {
  const {
    confirmedOrderNumber,
    selectedTable,
    user,
    reset,
  } = useWaiterStore();
  const branchId = user?.branchId ?? '';
  const tableId = selectedTable?.id;

  const requestBillMutation = useMutation({
    mutationFn: () =>
      waiterApi.patch(`/waiter/tables/${tableId}/request-bill?branchId=${branchId}`),
    onSuccess: () => reset(),
  });

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 px-6 gap-8">
      <div className="flex flex-col items-center gap-4">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center text-5xl shadow-sm">
          ✅
        </div>
        <h2 className="text-2xl font-black text-gray-900 text-center">
          ¡Orden enviada a cocina!
        </h2>
        {confirmedOrderNumber && (
          <p className="text-gray-500 text-base text-center">
            Número de orden:{' '}
            <span className="font-black text-gray-900 text-xl">#{confirmedOrderNumber}</span>
          </p>
        )}
        {selectedTable?.id && (
          <p className="text-gray-400 text-sm">Mesa {selectedTable.number}</p>
        )}
      </div>

      <div className="w-full max-w-sm flex flex-col gap-3">
        <button
          onClick={() => reset()}
          className="w-full bg-brand-600 hover:bg-brand-500 active:scale-95 text-white font-bold rounded-2xl py-4 text-base transition-all"
        >
          ➕ Nueva orden
        </button>
        {tableId && (
          <button
            onClick={() => requestBillMutation.mutate()}
            disabled={requestBillMutation.isPending}
            className="w-full bg-blue-50 hover:bg-blue-100 active:scale-95 text-blue-700 font-bold rounded-2xl py-4 text-base transition-all disabled:opacity-50"
          >
            🧾 Solicitar cuenta
          </button>
        )}
      </div>
    </div>
  );
}
