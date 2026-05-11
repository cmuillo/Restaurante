import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { useActiveBranchId } from '../../../hooks/useActiveBranchId';
import { useSocket } from '../../../hooks/useSocket';
import { useState } from 'react';
import { parseApiFormErrors } from '../../../lib/formErrors';

const STATUS_COLORS: Record<string, string> = {
  FREE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  OCCUPIED: 'bg-red-100 text-red-700 border-red-200',
  WAITING_FOOD: 'bg-amber-100 text-amber-700 border-amber-200',
  BILL_REQUESTED: 'bg-orange-100 text-orange-700 border-orange-200',
  RESERVED: 'bg-blue-100 text-blue-700 border-blue-200',
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
  const branchId = useActiveBranchId();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editTable, setEditTable] = useState<Table | null>(null);
  const [form, setForm] = useState({ number: '', name: '', capacity: '4' });
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  const showToast = (type: 'error' | 'success', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const { data: tables = [] } = useQuery({
    queryKey: ['tables', branchId],
    queryFn: () => api.get(`/tables?branchId=${branchId}`).then((r) => r.data),
    enabled: !!branchId,
  });

  // Actualización en tiempo real
  useSocket({
    branchId,
    events: {
      'order:status_updated': () => qc.invalidateQueries({ queryKey: ['tables', branchId] }),
      'table:updated': () => qc.invalidateQueries({ queryKey: ['tables', branchId] }),
    },
    enabled: !!branchId,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(
        `/tables/${id}/status?branchId=${branchId}`,
        { status },
        { headers: { 'X-Silent-Error': '1' } },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tables', branchId] }),
    onError: (error: any) => {
      const parsed = parseApiFormErrors(error);
      const msg = parsed.global || 'No se pudo cambiar el estado de la mesa. Verifica que el estado sea válido.';
      showToast('error', msg);
    },
  });

  const saveTable = useMutation({
    mutationFn: (data: object) =>
      editTable
        ? api.patch(`/tables/${editTable.id}?branchId=${branchId}`, data, { headers: { 'X-Silent-Error': '1' } })
        : api.post(`/tables?branchId=${branchId}`, data, { headers: { 'X-Silent-Error': '1' } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tables', branchId] });
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
    mutationFn: (id: string) => api.delete(`/tables/${id}?branchId=${branchId}`, { headers: { 'X-Silent-Error': '1' } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tables', branchId] }),
    onError: (error: any) => {
      const parsed = parseApiFormErrors(error);
      showToast('error', parsed.global || 'No se pudo eliminar la mesa.');
    },
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
      {toast && (
        <div className="fixed top-4 right-4 z-[60] max-w-sm">
          <div
            className={`rounded-lg border px-4 py-3 text-sm shadow-lg ${
              toast.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}

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
        {(tables as Table[]).map((t) => {
          const status = String(t.status ?? '').toUpperCase();
          return (
          <div
            key={t.id}
            className="bg-white rounded-xl border-2 border-gray-200 p-4 hover:shadow-lg transition-shadow cursor-pointer"
          >
            <div className="flex items-center justify-between mb-3 gap-2">
              <div>
                <p className="text-lg font-bold text-gray-900">🪑 Mesa {t.number}</p>
                {t.name && <p className="text-xs text-gray-500 font-medium">{t.name}</p>}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-1 rounded-full">👥 {t.capacity}</span>
                <button onClick={() => openEdit(t)} className="text-gray-300 hover:text-brand-500 text-lg p-0.5 transition-colors">✏️</button>
                <button onClick={() => { if (confirm(`¿Eliminar mesa ${t.number}?`)) deleteTable.mutate(t.id); }} className="text-gray-300 hover:text-red-500 text-lg p-0.5 transition-colors">🗑</button>
              </div>
            </div>
            <div className="mb-3">
              <span className={`inline-block px-3 py-1.5 rounded-full text-xs font-bold border ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                {status === 'FREE' && '✓ '}
                {status === 'OCCUPIED' && '👥 '}
                {status === 'WAITING_FOOD' && '⏱️ '}
                {status === 'BILL_REQUESTED' && '💳 '}
                {status === 'RESERVED' && '📌 '}
                {STATUS_LABELS[status] ?? t.status}
              </span>
            </div>

            <div className="space-y-2">
              {status === 'FREE' && (
                <button
                  className="w-full text-xs py-2 border-2 border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-semibold"
                  onClick={() => updateStatus.mutate({ id: t.id, status: 'reserved' })}
                >
                  📌 Reservar
                </button>
              )}
              {status === 'OCCUPIED' && (
                <button
                  className="w-full text-xs py-2 border-2 border-orange-300 text-orange-600 rounded-lg hover:bg-orange-50 transition-colors font-semibold"
                  onClick={() => updateStatus.mutate({ id: t.id, status: 'bill_requested' })}
                >
                  💳 Pedir cuenta
                </button>
              )}
              {(status === 'BILL_REQUESTED' || status === 'WAITING_FOOD') && (
                <button
                  className="w-full text-xs py-2 border-2 border-emerald-300 text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors font-semibold"
                  onClick={() => updateStatus.mutate({ id: t.id, status: 'free' })}
                >
                  ✓ Liberar mesa
                </button>
              )}
              {status === 'RESERVED' && (
                <>
                  <button
                    className="w-full text-xs py-2 border-2 border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors font-semibold"
                    onClick={() => updateStatus.mutate({ id: t.id, status: 'occupied' })}
                  >
                    👥 Ocupar
                  </button>
                  <button
                    className="w-full text-xs py-1.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-xs"
                    onClick={() => updateStatus.mutate({ id: t.id, status: 'free' })}
                  >
                    Cancelar reserva
                  </button>
                </>
              )}
            </div>
          </div>
          );
        })}
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

