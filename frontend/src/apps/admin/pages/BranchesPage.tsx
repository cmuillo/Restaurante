import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import api from '../../../lib/api';
import { parseApiFormErrors } from '../../../lib/formErrors';

type Branch = { id: string; name: string; address?: string; phone?: string; email?: string; isActive: boolean };

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

export default function BranchesPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [form, setForm] = useState({ name: '', address: '', phone: '', email: '', isActive: true });
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: () => api.get('/branches').then((r) => r.data),
  });

  const saveBranch = useMutation({
    mutationFn: (data: object) =>
      editBranch
        ? api.patch(`/branches/${editBranch.id}`, data, { headers: { 'X-Silent-Error': '1' } })
        : api.post('/branches', data, { headers: { 'X-Silent-Error': '1' } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] });
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
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.patch(`/branches/${id}`, { isActive: !isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branches'] }),
  });

  function openNew() {
    setEditBranch(null);
    setForm({ name: '', address: '', phone: '', email: '', isActive: true });
    setFormError('');
    setFieldErrors({});
    setShowModal(true);
  }
  function openEdit(b: Branch) {
    setEditBranch(b);
    setForm({ name: b.name, address: b.address ?? '', phone: b.phone ?? '', email: b.email ?? '', isActive: b.isActive });
    setFormError('');
    setFieldErrors({});
    setShowModal(true);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Sucursales</h2>
        <button onClick={openNew} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors">+ Nueva sucursal</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {branches.map((b) => (
          <div key={b.id} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-gray-900">{b.name}</p>
                {b.address && <p className="text-sm text-gray-500 mt-0.5">{b.address}</p>}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => toggleActive.mutate({ id: b.id, isActive: b.isActive })}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${b.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {b.isActive ? 'Activa' : 'Inactiva'}
                </button>
                <button onClick={() => openEdit(b)} className="text-gray-400 hover:text-brand-600 text-sm ml-1">&#9998;&#65039;</button>
              </div>
            </div>
            {b.phone && <p className="text-sm text-gray-600">&#128222; {b.phone}</p>}
            {b.email && <p className="text-sm text-gray-600">&#9993;&#65039; {b.email}</p>}
          </div>
        ))}
      </div>

      {showModal && (
        <Modal title={editBranch ? 'Editar sucursal' : 'Nueva sucursal'} onClose={() => setShowModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setFieldErrors((prev) => ({ ...prev, name: '' })); }} placeholder="Casa Matriz" />
              {fieldErrors.name && <p className="text-xs text-red-600 mt-1">{fieldErrors.name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Direccion</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={form.address} onChange={(e) => { setForm({ ...form, address: e.target.value }); setFieldErrors((prev) => ({ ...prev, address: '' })); }} />
              {fieldErrors.address && <p className="text-xs text-red-600 mt-1">{fieldErrors.address}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={form.phone} onChange={(e) => { setForm({ ...form, phone: e.target.value }); setFieldErrors((prev) => ({ ...prev, phone: '' })); }} />
              {fieldErrors.phone && <p className="text-xs text-red-600 mt-1">{fieldErrors.phone}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); setFieldErrors((prev) => ({ ...prev, email: '' })); }} />
              {fieldErrors.email && <p className="text-xs text-red-600 mt-1">{fieldErrors.email}</p>}
            </div>
            {formError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{formError}</p>}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="bActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded" />
              <label htmlFor="bActive" className="text-sm text-gray-700">Activa</label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={() => saveBranch.mutate(form)} disabled={!form.name || saveBranch.isPending}
                className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
                {saveBranch.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

