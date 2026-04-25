import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import api from '../../../lib/api';

export default function CustomersPage() {
  const [search, setSearch] = useState('');

  const { data: customers = [] } = useQuery({
    queryKey: ['customers', search],
    queryFn: () =>
      api.get(`/customers?${search ? `search=${encodeURIComponent(search)}&` : ''}limit=50`).then((r) => r.data),
  });

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Clientes (CRM)</h2>

      <input
        type="search"
        placeholder="Buscar por nombre, email o teléfono…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Nombre', 'Email', 'Teléfono', 'Puntos', 'Estado'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {customers.map((c: { id: string; name: string; email?: string; phone?: string; loyaltyPoints: number; isActive: boolean }) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                <td className="px-4 py-3 text-gray-600">{c.email ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600">{c.phone ?? '—'}</td>
                <td className="px-4 py-3 font-semibold text-brand-600">{c.loyaltyPoints} pts</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {c.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {customers.length === 0 && (
          <p className="text-center text-gray-400 py-12">No se encontraron clientes.</p>
        )}
      </div>
    </div>
  );
}
