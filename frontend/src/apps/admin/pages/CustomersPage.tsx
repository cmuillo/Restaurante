import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import api from '../../../lib/api';
import { parseApiFormErrors } from '../../../lib/formErrors';

type Customer = {
  id: string;
  code?: string;
  name: string;
  email?: string;
  phone?: string;
  taxId?: string;
  taxIdType?: string;
  address?: string;
  birthdate?: string;
  notes?: string;
  loyaltyPoints: number;
  isActive: boolean;
};

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [showModal, setShowModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', taxId: '', taxIdType: '', address: '', birthDate: '', notes: '' });
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers', search, statusFilter],
    queryFn: () => {
      const statusParam = statusFilter === 'active' ? 'true' : statusFilter === 'inactive' ? 'false' : 'all';
      return api.get(`/customers?${search ? `search=${encodeURIComponent(search)}&` : ''}isActive=${statusParam}&limit=50`).then((r) => r.data);
    },
  });

  const saveCustomer = useMutation({
    mutationFn: (data: object) =>
      editCustomer
        ? api.patch(`/customers/${editCustomer.id}`, data, { headers: { 'X-Silent-Error': '1' } })
        : api.post('/customers', data, { headers: { 'X-Silent-Error': '1' } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
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
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.patch(`/customers/${id}`, { isActive: !isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });

  const sendQr = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      api.post(`/customers/${id}/send-qr`, undefined, { headers: { 'X-Silent-Error': '1' } }).then((r) => r.data),
    onSuccess: (data) => {
      window.alert(data?.message ?? 'QR enviado correctamente');
    },
    onError: (error: any) => {
      const parsed = parseApiFormErrors(error);
      window.alert(parsed.global || 'No se pudo enviar el QR');
    },
  });

  function openNew() {
    setEditCustomer(null);
    setForm({ name: '', email: '', phone: '', taxId: '', taxIdType: '', address: '', birthDate: '', notes: '' });
    setFormError('');
    setFieldErrors({});
    setShowModal(true);
  }
  function openEdit(c: Customer) {
    setEditCustomer(c);
    setForm({ name: c.name, email: c.email ?? '', phone: c.phone ?? '', taxId: c.taxId ?? '', taxIdType: c.taxIdType ?? '', address: c.address ?? '', birthDate: c.birthdate ?? '', notes: c.notes ?? '' });
    setFormError('');
    setFieldErrors({});
    setShowModal(true);
  }

  return (
    <div className="min-h-0">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Clientes (CRM)</h2>
        <button onClick={openNew} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors">+ Nuevo cliente</button>
      </div>

      <input type="search" placeholder="Buscar por nombre, email o telefono..." value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />

      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setStatusFilter('active')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border ${statusFilter === 'active' ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-300 text-gray-600 hover:border-brand-400'}`}
        >
          Activos
        </button>
        <button
          onClick={() => setStatusFilter('inactive')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border ${statusFilter === 'inactive' ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-300 text-gray-600 hover:border-brand-400'}`}
        >
          Inactivos
        </button>
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border ${statusFilter === 'all' ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-300 text-gray-600 hover:border-brand-400'}`}
        >
          Todos
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="max-h-[calc(100vh-290px)] overflow-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            <tr>{['Codigo', 'Nombre', 'Cédula', 'Email', 'Telefono', 'Puntos', 'Estado', ''].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {customers.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">{c.code ?? '-'}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                <td className="px-4 py-3 text-gray-600">
                  {c.taxId ? (
                    <span className="text-xs">
                      <span className="inline-block bg-gray-100 text-gray-600 rounded px-1 mr-1">
                        {c.taxIdType === '01' ? 'Física' : c.taxIdType === '02' ? 'Jurídica' : c.taxIdType === '03' ? 'DIMEX' : c.taxIdType === '04' ? 'NITE' : c.taxIdType ?? ''}
                      </span>
                      {c.taxId}
                    </span>
                  ) : '-'}
                </td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{c.email ?? '-'}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{c.phone ?? '-'}</td>
                <td className="px-4 py-3 font-semibold text-brand-600 whitespace-nowrap">{c.loyaltyPoints} pts</td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleActive.mutate({ id: c.id, isActive: c.isActive })}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {c.isActive ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => sendQr.mutate({ id: c.id })}
                      disabled={!c.email || sendQr.isPending}
                      title={c.email ? `Enviar QR a ${c.email}` : 'El cliente no tiene email'}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Enviar QR
                    </button>
                    <button onClick={() => openEdit(c)} className="text-gray-400 hover:text-brand-600 text-sm">&#9998;&#65039;</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {customers.length === 0 && <p className="text-center text-gray-400 py-12">No se encontraron clientes para el filtro seleccionado.</p>}
      </div>

      {showModal && (
        <Modal title={editCustomer ? 'Editar cliente' : 'Nuevo cliente'} onClose={() => setShowModal(false)}>
          <div className="space-y-3">
            {/* Nombre */}
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setFieldErrors((prev) => ({ ...prev, name: '' })); }} placeholder="Juan Pérez" />
              {fieldErrors.name && <p className="text-xs text-red-600 mt-1">{fieldErrors.name}</p>}</div>

            {/* Cédula */}
            <div className="grid grid-cols-5 gap-2">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de cédula</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={form.taxIdType} onChange={(e) => setForm({ ...form, taxIdType: e.target.value })}>
                  <option value="">-- Tipo --</option>
                  <option value="01">01 — Física</option>
                  <option value="02">02 — Jurídica</option>
                  <option value="03">03 — DIMEX</option>
                  <option value="04">04 — NITE</option>
                </select>
              </div>
              <div className="col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Número de cédula</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={form.taxId} onChange={(e) => { setForm({ ...form, taxId: e.target.value }); setFieldErrors((prev) => ({ ...prev, taxId: '' })); }} placeholder="1-1234-5678" />
                {fieldErrors.taxId && <p className="text-xs text-red-600 mt-1">{fieldErrors.taxId}</p>}
              </div>
            </div>

            {/* Email y Teléfono */}
            <div className="grid grid-cols-2 gap-2">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); setFieldErrors((prev) => ({ ...prev, email: '' })); }} />
                {fieldErrors.email && <p className="text-xs text-red-600 mt-1">{fieldErrors.email}</p>}</div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={form.phone} onChange={(e) => { setForm({ ...form, phone: e.target.value }); setFieldErrors((prev) => ({ ...prev, phone: '' })); }} />
                {fieldErrors.phone && <p className="text-xs text-red-600 mt-1">{fieldErrors.phone}</p>}</div>
            </div>

            {/* Dirección */}
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Provincia, cantón, distrito, señas" />
            </div>

            {/* Fecha de nacimiento */}
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Fecha de nacimiento</label>
              <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
            </div>

            {/* Notas */}
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Notas internas</label>
              <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Preferencias, alergias, observaciones..." />
            </div>

            {formError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{formError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={() => saveCustomer.mutate(form)} disabled={!form.name || saveCustomer.isPending}
                className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
                {saveCustomer.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

