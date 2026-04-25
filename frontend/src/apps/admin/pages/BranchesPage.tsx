import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';

export default function BranchesPage() {
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get('/branches').then((r) => r.data),
  });

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Sucursales</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {branches.map((b: { id: string; name: string; address?: string; phone?: string; email?: string; isActive: boolean }) => (
          <div key={b.id} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-gray-900">{b.name}</p>
                {b.address && <p className="text-sm text-gray-500 mt-0.5">{b.address}</p>}
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${b.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {b.isActive ? 'Activa' : 'Inactiva'}
              </span>
            </div>
            {b.phone && <p className="text-sm text-gray-600">📞 {b.phone}</p>}
            {b.email && <p className="text-sm text-gray-600">✉️ {b.email}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
