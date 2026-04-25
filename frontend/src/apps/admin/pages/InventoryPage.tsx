import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth.store';

export default function InventoryPage() {
  const { user } = useAuthStore();
  const branchId = user?.branchId ?? '';

  const { data: items = [] } = useQuery({
    queryKey: ['inventory', branchId],
    queryFn: () => api.get(`/inventory?branchId=${branchId}`).then((r) => r.data),
    enabled: !!branchId,
  });

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Inventario</h2>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Producto', 'Unidad', 'Stock actual', 'Stock mínimo', 'Costo/U', 'Estado'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((i: { id: string; name: string; unit: string; currentStock: number; minStock: number; costPerUnit: number }) => {
              const isLow = i.currentStock <= i.minStock;
              return (
                <tr key={i.id} className={`hover:bg-gray-50 ${isLow ? 'bg-red-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{i.name}</td>
                  <td className="px-4 py-3 text-gray-500">{i.unit}</td>
                  <td className={`px-4 py-3 font-semibold ${isLow ? 'text-red-600' : 'text-gray-800'}`}>{i.currentStock}</td>
                  <td className="px-4 py-3 text-gray-500">{i.minStock}</td>
                  <td className="px-4 py-3 text-gray-600">${i.costPerUnit}</td>
                  <td className="px-4 py-3">
                    {isLow ? (
                      <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-xs font-medium">⚠️ Stock bajo</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">OK</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {items.length === 0 && (
          <p className="text-center text-gray-400 py-12">No hay artículos en inventario.</p>
        )}
      </div>
    </div>
  );
}
