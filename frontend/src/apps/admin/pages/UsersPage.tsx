import api from '../../../lib/api';
import { useActiveBranchId } from '../../../hooks/useActiveBranchId';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { parseApiFormErrors } from '../../../lib/formErrors';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  branch_admin: 'Admin Sucursal',
  cashier: 'Cajero',
  waiter: 'Mesero',
  chef: 'Chef',
  accountant: 'Contador',
};

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  branch?: { id: string; name: string };
  branchId?: string;
  isActive: boolean;
  lastLoginAt?: string;
};

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md p-6 border border-gray-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function UsersPage() {
  const branchId = useActiveBranchId();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'waiter',
    branchId: branchId || '',
    isActive: true,
  });
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users', branchId],
    queryFn: () =>
      api.get(`/users${branchId ? `?branchId=${branchId}` : ''}`).then((r) => r.data),
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () =>
      api.get('/branches?includeInactive=true').then((r) => r.data),
  });

  const saveUser = useMutation({
    mutationFn: (data: object) =>
      editUser
        ? api.patch(`/users/${editUser.id}`, data, {
            headers: { 'X-Silent-Error': '1' },
          })
        : api.post('/users', data, {
            headers: { 'X-Silent-Error': '1' },
          }),
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
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/users/${id}`, { isActive: !isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });

  function openNew() {
    setEditUser(null);
    setForm({
      name: '',
      email: '',
      password: '',
      role: 'waiter',
      branchId: branchId || '',
      isActive: true,
    });
    setFormError('');
    setFieldErrors({});
    setShowModal(true);
  }

  function openEdit(u: User) {
    setEditUser(u);
    setForm({
      name: u.name,
      email: u.email,
      password: '',
      role: u.role,
      branchId: u.branchId || '',
      isActive: u.isActive,
    });
    setFormError('');
    setFieldErrors({});
    setShowModal(true);
  }

  const activeUsers = users.filter((u) => u.isActive);
  const inactiveUsers = users.filter((u) => !u.isActive);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Usuarios
        </h2>
        <button
          onClick={openNew}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          + Nuevo usuario
        </button>
      </div>

      {/* Usuarios Activos */}
      {activeUsers.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-3">
            Activos ({activeUsers.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeUsers.map((u) => (
              <div
                key={u.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {u.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {u.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() =>
                        toggleActive.mutate({
                          id: u.id,
                          isActive: u.isActive,
                        })
                      }
                      disabled={toggleActive.isPending}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                        u.isActive
                          ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                      } disabled:opacity-50`}
                    >
                      {u.isActive ? 'Activo' : 'Inactivo'}
                    </button>
                    <button
                      onClick={() => openEdit(u)}
                      className="text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 text-sm ml-1"
                    >
                      ✏️
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 dark:text-gray-400">Rol:</span>
                    <span className="px-2 py-0.5 bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-400 rounded text-xs font-medium">
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </div>
                  {u.branch && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 dark:text-gray-400">
                        Sucursal:
                      </span>
                      <span className="text-gray-900 dark:text-gray-100">
                        {u.branch.name}
                      </span>
                    </div>
                  )}
                  {u.lastLoginAt && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Último login:{' '}
                      {new Date(u.lastLoginAt).toLocaleString('es-CR')}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Usuarios Inactivos */}
      {inactiveUsers.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-3">
            Inactivos ({inactiveUsers.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
            {inactiveUsers.map((u) => (
              <div
                key={u.id}
                className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {u.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {u.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() =>
                        toggleActive.mutate({
                          id: u.id,
                          isActive: u.isActive,
                        })
                      }
                      disabled={toggleActive.isPending}
                      className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400 disabled:opacity-50"
                    >
                      Inactivo
                    </button>
                    <button
                      onClick={() => openEdit(u)}
                      className="text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 text-sm ml-1"
                    >
                      ✏️
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 dark:text-gray-400">Rol:</span>
                    <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-400 rounded text-xs font-medium">
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </div>
                  {u.branch && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 dark:text-gray-400">
                        Sucursal:
                      </span>
                      <span className="text-gray-900 dark:text-gray-100">
                        {u.branch.name}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {users.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 px-6 py-12 text-center text-gray-500 dark:text-gray-400">
          No hay usuarios aún.
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <Modal
          title={editUser ? 'Editar usuario' : 'Nuevo usuario'}
          onClose={() => setShowModal(false)}
        >
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre *
              </label>
              <input
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={form.name}
                onChange={(e) => {
                  setForm({ ...form, name: e.target.value });
                  setFieldErrors((prev) => ({ ...prev, name: '' }));
                }}
                placeholder="Juan Pérez"
              />
              {fieldErrors.name && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {fieldErrors.name}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email *
              </label>
              <input
                type="email"
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={form.email}
                onChange={(e) => {
                  setForm({ ...form, email: e.target.value });
                  setFieldErrors((prev) => ({ ...prev, email: '' }));
                }}
                placeholder="juan@example.com"
              />
              {fieldErrors.email && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {editUser
                  ? 'Nueva contraseña (vacío = sin cambio)'
                  : 'Contraseña *'}
              </label>
              <input
                type="password"
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={form.password}
                onChange={(e) => {
                  setForm({ ...form, password: e.target.value });
                  setFieldErrors((prev) => ({ ...prev, password: '' }));
                }}
                placeholder="••••••••"
              />
              {fieldErrors.password && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Rol *
              </label>
              <select
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={form.role}
                onChange={(e) => {
                  setForm({ ...form, role: e.target.value });
                  setFieldErrors((prev) => ({ ...prev, role: '' }));
                }}
              >
                {Object.entries(ROLE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              {fieldErrors.role && (
                <p className="text-xs text-red-600 dark:text-red-400 -mt-2">
                  {fieldErrors.role}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Sucursal *
              </label>
              <select
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={form.branchId}
                onChange={(e) => {
                  setForm({ ...form, branchId: e.target.value });
                  setFieldErrors((prev) => ({ ...prev, branchId: '' }));
                }}
              >
                <option value="">Selecciona una sucursal</option>
                {branches.map((b: any) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              {fieldErrors.branchId && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {fieldErrors.branchId}
                </p>
              )}
            </div>

            {formError && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/15 rounded-lg px-3 py-2">
                {formError}
              </p>
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="uActive"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="rounded dark:bg-gray-700 dark:border-gray-600"
              />
              <label
                htmlFor="uActive"
                className="text-sm text-gray-700 dark:text-gray-300"
              >
                Activo
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={() =>
                  saveUser.mutate({
                    name: form.name,
                    email: form.email,
                    role: form.role,
                    branchId: form.branchId,
                    isActive: form.isActive,
                    ...(form.password ? { password: form.password } : {}),
                  })
                }
                disabled={
                  !form.name ||
                  !form.email ||
                  !form.branchId ||
                  (!editUser && !form.password) ||
                  saveUser.isPending
                }
                className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
              >
                {saveUser.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

