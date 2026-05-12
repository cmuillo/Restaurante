import { useQuery } from '@tanstack/react-query';
import { useBranchStore } from '../../../stores/branch.store';
import api from '../../../lib/api';

interface FacturingStatus {
  pendingCount: number;
  errorCount: number;
  rejectedCount: number;
  haciendaEnabled: boolean;
}

export function FacturingStatusIndicator() {
  const { activeBranchId } = useBranchStore();


  const { data: status } = useQuery<FacturingStatus>({
    queryKey: ['facturing-status', activeBranchId],
    queryFn: async () => {
      return api
        .get(`/settings/billing-status/${activeBranchId}`)
        .then((r) => r.data);
    },
    refetchInterval: 30000, // Refrescar cada 30 segundos
    enabled: !!activeBranchId,
  });
  // Determinar estado y color
  let bgColor = 'bg-gray-100';
  let textColor = 'text-gray-700';
  let dotColor = 'bg-gray-400';
  let statusText = 'Facturación apagada';

  if (status?.haciendaEnabled) {
    bgColor = 'bg-emerald-100';
    textColor = 'text-emerald-700';
    dotColor = 'bg-emerald-500';
    statusText = 'Facturación OK';

    if (status.errorCount > 0 || status.rejectedCount > 0) {
      bgColor = 'bg-red-100';
      textColor = 'text-red-700';
      dotColor = 'bg-red-500';
      statusText = `❌ Errores: ${status.errorCount + status.rejectedCount}`;
    } else if (status.pendingCount > 0) {
      bgColor = 'bg-amber-100';
      textColor = 'text-amber-700';
      dotColor = 'bg-amber-500';
      statusText = `⏳ Pendientes: ${status.pendingCount}`;
    }
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold ${bgColor} ${textColor} border border-current border-opacity-30`}
      title={`Hacienda: ${statusText}`}
    >
      <span className={`inline-block w-2 h-2 rounded-full ${dotColor} animate-pulse`} />
      <span className="hidden sm:inline">{statusText}</span>
      <span className="sm:hidden">
        {!status?.haciendaEnabled
          ? '⚫'
          : status.errorCount > 0 || status.rejectedCount > 0
            ? '❌'
            : status.pendingCount > 0
              ? '⏳'
              : '✓'}
      </span>
    </div>
  );
}
