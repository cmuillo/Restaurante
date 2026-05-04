import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth.store';
import { useSocket } from '../../../hooks/useSocket';
import { useState } from 'react';
import { parseApiFormErrors } from '../../../lib/formErrors';

const STATUS_COLORS: Record<string, string> = {
  FREE: 'bg-green-100 text-green-700',
  OCCUPIED: 'bg-red-100 text-red-700',
  WAITING_FOOD: 'bg-yellow-100 text-yellow-700',
  BILL_REQUESTED: 'bg-orange-100 text-orange-700',
  RESERVED: 'bg-blue-100 text-blue-700',
};

const STATUS_LABELS: Record<string, string> = {
  FREE: 'Libre',
  OCCUPIED: 'Ocupada',
  WAITING_FOOD: 'Esperando comida',
  BILL_REQUESTED: 'Pide la cuenta',
  RESERVED: 'Reservada',
};

type Table = { id: string; number: number; name?: string; capacity: number; status: string };

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
export default function TablesPage() {
  const { user } = useAuthStore();
  const branchId = user?.branchId ?? '';
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editTable, setEditTable] = useState<Table | null>(null);
  const [form, setForm] = useState({ number: '', name: '', capacity: '4' });
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { data: tables = [] } = useQuery({
    queryKey: ['tables', branchId],
    queryFn: () => api.get(`/tables?branchId=${branchId}`).then((r) => r.data),
    enabled: !!branchId,
  });

  // Actualización en tiempo real
  useSocket({
    branchId,
    events: {
      'order:status_updated': () => qc.invalidateQueries({ queryKey: ['tables'] }),
    },
    enabled: !!branchId,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/tables/${id}/status?branchId=${branchId}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tables'] }),
  });

  const saveTable = useMutation({
    mutationFn: (data: object) =>
      editTable
        ? api.patch(`/tables/${editTable.id}?branchId=${branchId}`, data, { headers: { 'X-Silent-Error': '1' } })
        : api.post(`/tables?branchId=${branchId}`, data, { headers: { 'X-Silent-Error': '1' } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tables'] });
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

  const deleteTable = useMutation({
    mutationFn: (id: string) => api.delete(`/tables/${id}?branchId=${branchId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tables'] }),
  });

  function openNew() {
    setEditTable(null);
    setForm({ number: '', name: '', capacity: '4' });
    setFormError('');
    setFieldErrors({});
    setShowModal(true);
  }
  function openEdit(t: Table) {
    setEditTable(t);
    setForm({ number: String(t.number), name: t.name ?? '', capacity: String(t.capacity) });
    setFormError('');
    setFieldErrors({});
    setShowModal(true);
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Mesas</h2>
        <button onClick={openNew} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors">+ Nueva mesa</button>
      </div>

      {tables.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">🪑</div>
          <p className="font-medium">No hay mesas registradas</p>
          <p className="text-sm mt-1">Haz clic en "+ Nueva mesa" para crear la primera</p>
        </div>
      ) : (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {(tables as Table[]).map((t) => (
          <div
            key={t.id}
            className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2 gap-1">
              <div>
                <p className="text-lg font-bold text-gray-900">Mesa {t.number}</p>
                {t.name && <p className="text-xs text-gray-500">{t.name}</p>}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs">👥 {t.capacity}</span>
                <button onClick={() => openEdit(t)} className="text-gray-300 hover:text-brand-500 text-xs p-0.5">✏️</button>
                <button onClick={() => { if (confirm(`¿Eliminar mesa ${t.number}?`)) deleteTable.mutate(t.id); }} className="text-gray-300 hover:text-red-500 text-xs p-0.5">🗑</button>
              </div>
            </div>
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[t.status] ?? 'bg-gray-100 text-gray-500'}`}>
              {STATUS_LABELS[t.status] ?? t.status}
            </span>

            {t.status === 'OCCUPIED' && (
              <button
                className="mt-3 w-full text-xs py-1 border border-orange-300 text-orange-600 rounded-lg hover:bg-orange-50 transition-colors"
                onClick={() => updateStatus.mutate({ id: t.id, status: 'BILL_REQUESTED' })}
              >
                Pedir cuenta
              </button>
            )}
            {(t.status === 'BILL_REQUESTED' || t.status === 'WAITING_FOOD') && (
              <button
                className="mt-3 w-full text-xs py-1 border border-green-300 text-green-600 rounded-lg hover:bg-green-50 transition-colors"
                onClick={() => updateStatus.mutate({ id: t.id, status: 'FREE' })}
              >
                Liberar mesa
              </button>
            )}
          </div>
        ))}
      </div>
        )}

        {showModal && (
          <Modal title={editTable ? `Editar mesa ${editTable.number}` : 'Nueva mesa'} onClose={() => setShowModal(false)}>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número *</label>
                <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={form.number} onChange={(e) => { setForm({ ...form, number: e.target.value }); setFieldErrors((prev) => ({ ...prev, number: '' })); }} placeholder="1" />
                {fieldErrors.number && <p className="text-xs text-red-600 mt-1">{fieldErrors.number}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre / Descripción</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setFieldErrors((prev) => ({ ...prev, location: '', name: '' })); }} placeholder="Ej: Terraza, Privado…" />
                {(fieldErrors.location || fieldErrors.name) && <p className="text-xs text-red-600 mt-1">{fieldErrors.location || fieldErrors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Capacidad *</label>
                <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={form.capacity} onChange={(e) => { setForm({ ...form, capacity: e.target.value }); setFieldErrors((prev) => ({ ...prev, capacity: '' })); }} placeholder="4" />
                {fieldErrors.capacity && <p className="text-xs text-red-600 mt-1">{fieldErrors.capacity}</p>}
              </div>
              {formError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{formError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
                <button onClick={() => saveTable.mutate({ number: form.number, location: form.name || undefined, capacity: Number(form.capacity) })}
                  disabled={!form.number || !form.capacity || saveTable.isPending}
                  className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
                  {saveTable.isPending ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </Modal>
        )}
    </div>
  );
}

