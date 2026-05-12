import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import api from '../../../lib/api';
import { parseApiFormErrors } from '../../../lib/formErrors';
import { customAlert } from '../../../lib/api';

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

function Modal({ title, icon, onClose, children }: { title: string; icon?: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[var(--color-bg-secondary,#1e2435)] border border-white/10 rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10">
          {icon && (
            <div className="w-9 h-9 rounded-xl bg-brand-600/20 flex items-center justify-center text-brand-400 text-lg flex-shrink-0">
              {icon}
            </div>
          )}
          <h3 className="text-base font-semibold text-white flex-1">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors text-lg leading-none"
          >
            &times;
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
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
  const [form, setForm] = useState({ name: '', email: '', phone: '', taxId: '', taxIdType: '', address: '', birthdate: '', notes: '' });
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
      const settings = JSON.parse(localStorage.getItem('settings') || '{}');
      const systemName = settings.restaurantName || 'Restaurante';
      customAlert(data?.message ?? 'QR enviado correctamente', systemName);
    },
    onError: (error: any) => {
      const parsed = parseApiFormErrors(error);
      const settings = JSON.parse(localStorage.getItem('settings') || '{}');
      const systemName = settings.restaurantName || 'Restaurante';
      customAlert(parsed.global || 'No se pudo enviar el QR', systemName);
    },
  });

  function openNew() {
    setEditCustomer(null);
    setForm({ name: '', email: '', phone: '', taxId: '', taxIdType: '', address: '', birthdate: '', notes: '' });
    setFormError('');
    setFieldErrors({});
    setShowModal(true);
  }
  function openEdit(c: Customer) {
    setEditCustomer(c);
    setForm({
      name: c.name,
      email: c.email ?? '',
      phone: c.phone ?? '',
      taxId: c.taxId ?? '',
      taxIdType: c.taxIdType ?? '',
      address: c.address ?? '',
      birthdate: c.birthdate ?? '',
      notes: c.notes ?? ''
    });
    setFormError('');
    setFieldErrors({});
    setShowModal(true);
  }

  const getMaskForTaxIdType = (type: string) => {
    switch (type) {
      case '01': // Cédula Física
        return '9-9999-9999';
      case '02': // Cédula Jurídica
        return '3-999-999999';
      case '03': // DIMEX
        return '999999999999';
      case '04': // NITE
        return '999999999999';
      default:
        return '';
    }
  };

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
        <Modal
          title={editCustomer ? 'Editar cliente' : 'Nuevo cliente'}
          icon={editCustomer ? '✏️' : '👤'}
          onClose={() => setShowModal(false)}
        >
          <div className="space-y-5">

            {/* ── Información personal ── */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 mb-3">Información personal</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Nombre completo <span className="text-red-400">*</span></label>
                  <input
                    className={`w-full bg-white/5 border ${fieldErrors.name ? 'border-red-500' : 'border-white/10'} rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition`}
                    value={form.name}
                    onChange={(e) => { setForm({ ...form, name: e.target.value }); setFieldErrors((prev) => ({ ...prev, name: '' })); }}
                    placeholder="Ej: Juan Pérez Rodríguez"
                  />
                  {fieldErrors.name && <p className="text-xs text-red-400 mt-1">{fieldErrors.name}</p>}
                </div>

                <div className="grid grid-cols-5 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-400 mb-1">Tipo de cédula</label>
                    <select
                      value={form.taxIdType}
                      onChange={(e) => setForm((prev) => ({ ...prev, taxIdType: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                    >
                      <option value="01">01 — Cédula Física</option>
                      <option value="02">02 — Cédula Jurídica</option>
                      <option value="03">03 — DIMEX</option>
                      <option value="04">04 — NITE</option>
                    </select>
                  </div>
                  <div className="col-span-3">
                    <label className="block text-xs font-medium text-gray-400 mb-1">Número de cédula</label>
                    <input
                      value={form.taxId}
                      onChange={(e) => setForm((prev) => ({ ...prev, taxId: e.target.value }))}
                      placeholder={getMaskForTaxIdType(form.taxIdType) || 'Número de identificación'}
                      className={`w-full bg-white/5 border ${fieldErrors.taxId ? 'border-red-500' : 'border-white/10'} rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition`}
                    />
                    {fieldErrors.taxId && <p className="text-xs text-red-400 mt-1">{fieldErrors.taxId}</p>}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-white/8" />

            {/* ── Contacto ── */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 mb-3">Contacto</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Correo electrónico</label>
                  <input
                    type="email"
                    className={`w-full bg-white/5 border ${fieldErrors.email ? 'border-red-500' : 'border-white/10'} rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition`}
                    value={form.email}
                    onChange={(e) => { setForm({ ...form, email: e.target.value }); setFieldErrors((prev) => ({ ...prev, email: '' })); }}
                    placeholder="correo@ejemplo.com"
                  />
                  {fieldErrors.email && <p className="text-xs text-red-400 mt-1">{fieldErrors.email}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Teléfono</label>
                  <input
                    className={`w-full bg-white/5 border ${fieldErrors.phone ? 'border-red-500' : 'border-white/10'} rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition`}
                    value={form.phone}
                    onChange={(e) => { setForm({ ...form, phone: e.target.value }); setFieldErrors((prev) => ({ ...prev, phone: '' })); }}
                    placeholder="8888-0000"
                  />
                  {fieldErrors.phone && <p className="text-xs text-red-400 mt-1">{fieldErrors.phone}</p>}
                </div>
              </div>
            </div>

            <div className="border-t border-white/8" />

            {/* ── Dirección y nacimiento ── */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 mb-3">Datos adicionales</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Dirección</label>
                  <input
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Provincia, cantón, distrito, señas"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Fecha de nacimiento</label>
                  <input
                    type="date"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition [color-scheme:dark]"
                    value={form.birthdate}
                    onChange={(e) => setForm({ ...form, birthdate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Notas internas</label>
                  <textarea
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition resize-none"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Preferencias, alergias, observaciones..."
                  />
                </div>
              </div>
            </div>

            {formError && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                <span className="text-red-400 text-sm flex-shrink-0">⚠</span>
                <p className="text-sm text-red-400">{formError}</p>
              </div>
            )}

            {/* ── Acciones ── */}
            <div className="flex justify-end gap-3 pt-1">
              <button
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 text-sm font-medium border border-white/15 text-gray-300 rounded-xl hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => saveCustomer.mutate(form)}
                disabled={!form.name || saveCustomer.isPending}
                className="px-5 py-2.5 text-sm font-semibold bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saveCustomer.isPending ? (
                  <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Guardando...</span>
                ) : (
                  editCustomer ? 'Guardar cambios' : 'Crear cliente'
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

