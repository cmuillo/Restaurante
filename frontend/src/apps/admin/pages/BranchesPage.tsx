import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import api from '../../../lib/api';
import { parseApiFormErrors } from '../../../lib/formErrors';

type Branch = { id: string; name: string; address?: string; phone?: string; email?: string; isActive: boolean };
type DayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
type BusinessHours = Record<DayKey, { open: string; close: string; closed: boolean }>;
type BranchConfig = { id: string; branchId: string; businessHours?: Partial<BusinessHours> | null };

const DAYS: Array<{ key: DayKey; label: string }> = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  monday: { open: '06:00', close: '22:00', closed: false },
  tuesday: { open: '06:00', close: '22:00', closed: false },
  wednesday: { open: '06:00', close: '22:00', closed: false },
  thursday: { open: '06:00', close: '22:00', closed: false },
  friday: { open: '06:00', close: '22:00', closed: false },
  saturday: { open: '06:00', close: '22:00', closed: false },
  sunday: { open: '06:00', close: '22:00', closed: false },
};

function mergeBusinessHours(input?: Partial<BusinessHours> | null): BusinessHours {
  return {
    monday: { ...DEFAULT_BUSINESS_HOURS.monday, ...(input?.monday ?? {}) },
    tuesday: { ...DEFAULT_BUSINESS_HOURS.tuesday, ...(input?.tuesday ?? {}) },
    wednesday: { ...DEFAULT_BUSINESS_HOURS.wednesday, ...(input?.wednesday ?? {}) },
    thursday: { ...DEFAULT_BUSINESS_HOURS.thursday, ...(input?.thursday ?? {}) },
    friday: { ...DEFAULT_BUSINESS_HOURS.friday, ...(input?.friday ?? {}) },
    saturday: { ...DEFAULT_BUSINESS_HOURS.saturday, ...(input?.saturday ?? {}) },
    sunday: { ...DEFAULT_BUSINESS_HOURS.sunday, ...(input?.sunday ?? {}) },
  };
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4 p-6 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none font-light">&times;</button>
        </div>
        <div className="px-6 py-4 flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function BranchesPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [showHoursModal, setShowHoursModal] = useState(false);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [hoursBranch, setHoursBranch] = useState<Branch | null>(null);
  const [hoursLoading, setHoursLoading] = useState(false);
  const [hoursError, setHoursError] = useState('');
  const [hoursForm, setHoursForm] = useState<BusinessHours>(DEFAULT_BUSINESS_HOURS);
  const [form, setForm] = useState({ name: '', address: '', phone: '', email: '', isActive: true });
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: () => api.get('/branches?includeInactive=true').then((r) => r.data),
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

  const saveHours = useMutation({
    mutationFn: (data: { branchId: string; businessHours: BusinessHours }) =>
      api.put(
        `/branches/${data.branchId}/config`,
        { businessHours: data.businessHours },
        { headers: { 'X-Silent-Error': '1' } },
      ),
    onSuccess: () => {
      setShowHoursModal(false);
      setHoursError('');
    },
    onError: (error: any) => {
      const parsed = parseApiFormErrors(error);
      setHoursError(parsed.global);
    },
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

  async function openHours(branch: Branch) {
    setHoursBranch(branch);
    setHoursError('');
    setHoursLoading(true);
    setHoursForm(DEFAULT_BUSINESS_HOURS);
    setShowHoursModal(true);

    try {
      const { data } = await api.get<BranchConfig>(`/branches/${branch.id}/config`);
      setHoursForm(mergeBusinessHours(data?.businessHours));
    } catch {
      setHoursError('No se pudo cargar el horario de la sucursal.');
    } finally {
      setHoursLoading(false);
    }
  }

  function updateHour(day: DayKey, field: 'open' | 'close', value: string) {
    setHoursForm((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  }

  function toggleClosed(day: DayKey, closed: boolean) {
    setHoursForm((prev) => ({
      ...prev,
      [day]: { ...prev[day], closed },
    }));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">🏢 Sucursales</h2>
          <p className="text-gray-600 text-sm mt-1">Gestiona todas tus sucursales y sus horarios operativos</p>
        </div>
        <button onClick={openNew} className="px-5 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-semibold hover:bg-brand-700 transition-colors shadow-md hover:shadow-lg">
          ➕ Nueva sucursal
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {branches.map((b) => (
          <div key={b.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <p className="font-bold text-lg text-gray-900">{b.name}</p>
                {b.address && <p className="text-sm text-gray-600 mt-1">{b.address}</p>}
              </div>
              <button onClick={() => toggleActive.mutate({ id: b.id, isActive: b.isActive })}
                className={`ml-2 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  b.isActive 
                    ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {b.isActive ? '✓ Activa' : 'Inactiva'}
              </button>
            </div>
            
            <div className="space-y-2 mb-4 text-sm text-gray-700">
              {b.phone && <p><span className="text-gray-500">📞</span> {b.phone}</p>}
              {b.email && <p><span className="text-gray-500">✉️</span> {b.email}</p>}
            </div>
            
            <div className="flex gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => openHours(b)}
                className="flex-1 text-sm font-medium text-brand-700 hover:text-brand-800 hover:bg-brand-50 py-2 rounded-lg transition-colors"
              >
                ⏰ Horario
              </button>
              <button
                onClick={() => openEdit(b)}
                className="flex-1 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 py-2 rounded-lg transition-colors"
              >
                ✎️ Editar
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <Modal title={editBranch ? '✎️ Editar sucursal' : '➕ Nueva sucursal'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Nombre de la sucursal *</label>
              <input className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setFieldErrors((prev) => ({ ...prev, name: '' })); }} placeholder="ej. Casa Matriz" />
              {fieldErrors.name && <p className="text-xs text-red-600 mt-1">{fieldErrors.name}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Dirección</label>
              <input className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                value={form.address} onChange={(e) => { setForm({ ...form, address: e.target.value }); setFieldErrors((prev) => ({ ...prev, address: '' })); }} placeholder="ej. San José, CR" />
              {fieldErrors.address && <p className="text-xs text-red-600 mt-1">{fieldErrors.address}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Teléfono</label>
              <input className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                value={form.phone} onChange={(e) => { setForm({ ...form, phone: e.target.value }); setFieldErrors((prev) => ({ ...prev, phone: '' })); }} placeholder="ej. 2222-1234" />
              {fieldErrors.phone && <p className="text-xs text-red-600 mt-1">{fieldErrors.phone}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Email</label>
              <input type="email" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); setFieldErrors((prev) => ({ ...prev, email: '' })); }} placeholder="ej. sucursal@ejemplo.com" />
              {fieldErrors.email && <p className="text-xs text-red-600 mt-1">{fieldErrors.email}</p>}
            </div>
            {formError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3 border border-red-200">{formError}</p>}
            <div className="bg-gray-50 rounded-lg p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded w-4 h-4" />
                <span className="text-sm font-medium text-gray-900">Sucursal activa</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={() => saveBranch.mutate(form)} disabled={!form.name || saveBranch.isPending}
                className="px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors">
                {saveBranch.isPending ? '⏳ Guardando...' : '✓ Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showHoursModal && (
        <Modal
          title={`⏰ Horario operativo: ${hoursBranch?.name ?? 'Sucursal'}`}
          onClose={() => {
            if (saveHours.isPending) return;
            setShowHoursModal(false);
          }}
        >
          <div className="space-y-4">
            {hoursLoading ? (
              <div className="text-center py-8">
                <div className="text-sm text-gray-500">Cargando horario...</div>
              </div>
            ) : (
              <>
                <div className="bg-brand-50 rounded-lg p-4 mb-6">
                  <p className="text-sm text-brand-900">
                    <strong>Configurar los horarios de operación</strong> para cada día de la semana. 
                    Marca "Cerrado" si ese día no opera.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {DAYS.map(({ key, label }) => (
                    <div key={key} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-gray-900">{label}</span>
                        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer hover:text-gray-900">
                          <input
                            type="checkbox"
                            checked={hoursForm[key].closed}
                            onChange={(e) => toggleClosed(key, e.target.checked)}
                            className="rounded w-4 h-4"
                          />
                          <span>Cerrado</span>
                        </label>
                      </div>
                      
                      {!hoursForm[key].closed && (
                        <div className="space-y-2">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Apertura</label>
                            <input
                              type="time"
                              value={hoursForm[key].open}
                              onChange={(e) => updateHour(key, 'open', e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Cierre</label>
                            <input
                              type="time"
                              value={hoursForm[key].close}
                              onChange={(e) => updateHour(key, 'close', e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                          </div>
                        </div>
                      )}
                      
                      {hoursForm[key].closed && (
                        <div className="text-center py-3 text-sm text-gray-500 italic">
                          Sucursal cerrada
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {hoursError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3 border border-red-200">{hoursError}</p>}

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
              <button
                onClick={() => setHoursForm(DEFAULT_BUSINESS_HOURS)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                🔄 Restaurar
              </button>
              <button
                onClick={() => setShowHoursModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={saveHours.isPending}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!hoursBranch) return;
                  saveHours.mutate({ branchId: hoursBranch.id, businessHours: hoursForm });
                }}
                disabled={saveHours.isPending || hoursLoading || !hoursBranch}
                className="px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {saveHours.isPending ? '⏳ Guardando...' : '✓ Guardar horario'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

