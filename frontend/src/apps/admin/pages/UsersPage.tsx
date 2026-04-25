import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth.store';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  branch_admin: 'Admin Sucursal',
  cashier: 'Cajero',
  waiter: 'Mesero',
  chef: 'Chef',
  accountant: 'Contador',
};

export default function UsersPage() {
  const { user } = useAuthStore();
  const branchId = user?.branchId;

  const { data: users = [] } = useQuery({
    queryKey: ['users', branchId],
    queryFn: () =>
      api
        .get(`/users${branchId ? `?branchId=${branchId}` : ''}`)
        .then((r) => r.data),
  });

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Usuarios</h2>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Nombre', 'Email', 'Rol', 'Sucursal', 'Estado'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u: { id: string; name: string; email: string; role: string; branch?: { name: string }; isActive: boolean }) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 bg-brand-50 text-brand-700 rounded-full text-xs font-medium">
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{u.branch?.name ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {u.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
