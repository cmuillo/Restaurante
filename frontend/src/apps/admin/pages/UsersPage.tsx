import api from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth.store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { parseApiFormErrors } from '../../../lib/formErrors';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin', branch_admin: 'Admin Sucursal', cashier: 'Cajero',
  waiter: 'Mesero', chef: 'Chef', accountant: 'Contador',
};
type User = { id: string; name: string; email: string; role: string; branch?: { name: string }; isActive: boolean };

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function UsersPage() {
  const { user } = useAuthStore();
  const branchId = user?.branchId;
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'waiter', isActive: true });
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users', branchId],
    queryFn: () => api.get(`/users${branchId ? `?branchId=${branchId}` : ''}`).then((r) => r.data),
  });

  const saveUser = useMutation({
    mutationFn: (data: object) =>
      editUser
        ? api.patch(`/users/${editUser.id}`, data, { headers: { 'X-Silent-Error': '1' } })
        : api.post('/users', { ...data, branchId }, { headers: { 'X-Silent-Error': '1' } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setShowModal(false);
      setFormError('');
      setFieldErrors({});
    },
    onError: (error: any) => {
      const parsed = parseApiFormErrors(error);
      setFormError(parsed.global);
      setFieldErrors(parsed.fields);
    },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.patch(`/users/${id}`, { isActive: !isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  function openNew() {
    setEditUser(null);
    setForm({ name: '', email: '', password: '', role: 'waiter', isActive: true });
    setFormError('');
    setFieldErrors({});
    setShowModal(true);
  }
  function openEdit(u: User) {
    setEditUser(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role, isActive: u.isActive });
    setFormError('');
    setFieldErrors({});
    setShowModal(true);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Usuarios</h2>
        <button onClick={openNew} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors">+ Nuevo usuario</button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>{['Nombre', 'Email', 'Rol', 'Sucursal', 'Estado', ''].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                <td className="px-4 py-3"><span className="px-2 py-0.5 bg-brand-50 text-brand-700 rounded-full text-xs font-medium">{ROLE_LABELS[u.role] ?? u.role}</span></td>
                <td className="px-4 py-3 text-gray-500">{u.branch?.name ?? '—'}</td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleActive.mutate({ id: u.id, isActive: u.isActive })}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {u.isActive ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
                <td className="px-4 py-3"><button onClick={() => openEdit(u)} className="text-gray-400 hover:text-brand-600 text-sm">✏️</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showModal && (
        <Modal title={editUser ? 'Editar usuario' : 'Nuevo usuario'} onClose={() => setShowModal(false)}>
          <div className="space-y-3">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setFieldErrors((prev) => ({ ...prev, name: '' })); }} placeholder="Juan Pérez" />
              {fieldErrors.name && <p className="text-xs text-red-600 mt-1">{fieldErrors.name}</p>}</div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); setFieldErrors((prev) => ({ ...prev, email: '' })); }} />
              {fieldErrors.email && <p className="text-xs text-red-600 mt-1">{fieldErrors.email}</p>}</div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{editUser ? 'Nueva contraseña (vacío = sin cambio)' : 'Contraseña *'}</label>
              <input type="password" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={form.password} onChange={(e) => { setForm({ ...form, password: e.target.value }); setFieldErrors((prev) => ({ ...prev, password: '' })); }} placeholder="••••••••" />
              {fieldErrors.password && <p className="text-xs text-red-600 mt-1">{fieldErrors.password}</p>}</div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Rol *</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={form.role} onChange={(e) => { setForm({ ...form, role: e.target.value }); setFieldErrors((prev) => ({ ...prev, role: '' })); }}>
                {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select></div>
            {fieldErrors.role && <p className="text-xs text-red-600 -mt-2">{fieldErrors.role}</p>}
            {formError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{formError}</p>}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="uActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded" />
              <label htmlFor="uActive" className="text-sm text-gray-700">Activo</label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={() => saveUser.mutate({ name: form.name, email: form.email, role: form.role, isActive: form.isActive, ...(form.password ? { password: form.password } : {}) })}
                disabled={!form.name || !form.email || (!editUser && !form.password) || saveUser.isPending}
                className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
                {saveUser.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

