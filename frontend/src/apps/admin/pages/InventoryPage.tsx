import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import api from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth.store';
import { parseApiFormErrors } from '../../../lib/formErrors';

type InventoryItem = { id: string; name: string; unit: string; currentStock: number; minStock: number; costPerUnit: number };

const UNITS = ['unit', 'kg', 'gram', 'liter', 'ml', 'portion'];
const ADJ_TYPES = [
  { value: 'in', label: 'Entrada' },
  { value: 'out', label: 'Salida' },
  { value: 'adjustment', label: 'Ajuste manual' },
];

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

export default function InventoryPage() {
  const { user } = useAuthStore();
  const branchId = user?.branchId ?? '';
  const qc = useQueryClient();

  const [showItemModal, setShowItemModal] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [itemForm, setItemForm] = useState({ name: '', unit: 'unit', currentStock: '0', minimumStock: '0', costPerUnit: '0' });
  const [itemFormError, setItemFormError] = useState('');
  const [itemFieldErrors, setItemFieldErrors] = useState<Record<string, string>>({});

  const [showAdjModal, setShowAdjModal] = useState(false);
  const [adjItem, setAdjItem] = useState<InventoryItem | null>(null);
  const [adjForm, setAdjForm] = useState({ quantity: '', type: 'in', notes: '' });
  const [adjFormError, setAdjFormError] = useState('');
  const [adjFieldErrors, setAdjFieldErrors] = useState<Record<string, string>>({});

  const { data: items = [] } = useQuery<InventoryItem[]>({
    queryKey: ['inventory', branchId],
    queryFn: () => api.get(`/inventory/items?branchId=${branchId}`).then((r) => r.data),
    enabled: !!branchId,
  });

  const saveItem = useMutation({
    mutationFn: (data: object) =>
      editItem
        ? api.patch(`/inventory/items/${editItem.id}?branchId=${branchId}`, data, { headers: { 'X-Silent-Error': '1' } })
        : api.post(`/inventory/items?branchId=${branchId}`, data, { headers: { 'X-Silent-Error': '1' } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      setShowItemModal(false);
      setItemFormError('');
      setItemFieldErrors({});
    },
    onError: (error: any) => {
      const parsed = parseApiFormErrors(error);
      setItemFormError(parsed.global);
      setItemFieldErrors(parsed.fields);
    },
  });

  const adjustStock = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) => api.post(`/inventory/items/${id}/adjust?branchId=${branchId}`, data, { headers: { 'X-Silent-Error': '1' } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      setShowAdjModal(false);
      setAdjFormError('');
      setAdjFieldErrors({});
    },
    onError: (error: any) => {
      const parsed = parseApiFormErrors(error);
      setAdjFormError(parsed.global);
      setAdjFieldErrors(parsed.fields);
    },
  });

  function openNew() {
    setEditItem(null);
    setItemForm({ name: '', unit: 'unit', currentStock: '0', minimumStock: '0', costPerUnit: '0' });
    setItemFormError('');
    setItemFieldErrors({});
    setShowItemModal(true);
  }
  function openEdit(i: InventoryItem) {
    setEditItem(i);
    setItemForm({ name: i.name, unit: i.unit, currentStock: String(i.currentStock), minimumStock: String(i.minStock), costPerUnit: String(i.costPerUnit) });
    setItemFormError('');
    setItemFieldErrors({});
    setShowItemModal(true);
  }
  function openAdj(i: InventoryItem) {
    setAdjItem(i);
    setAdjForm({ quantity: '', type: 'in', notes: '' });
    setAdjFormError('');
    setAdjFieldErrors({});
    setShowAdjModal(true);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Inventario</h2>
        <button onClick={openNew} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors">+ Nuevo item</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>{['Producto', 'Unidad', 'Stock actual', 'Stock minimo', 'Costo/U', 'Estado', ''].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((i) => {
              const isLow = i.currentStock <= i.minStock;
              return (
                <tr key={i.id} className={`hover:bg-gray-50 ${isLow ? 'bg-red-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{i.name}</td>
                  <td className="px-4 py-3 text-gray-500">{i.unit}</td>
                  <td className={`px-4 py-3 font-semibold ${isLow ? 'text-red-600' : 'text-gray-800'}`}>{i.currentStock}</td>
                  <td className="px-4 py-3 text-gray-500">{i.minStock}</td>
                  <td className="px-4 py-3 text-gray-600">${i.costPerUnit}</td>
                  <td className="px-4 py-3">{isLow
                    ? <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-xs font-medium">Stock bajo</span>
                    : <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">OK</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button onClick={() => openAdj(i)} className="text-xs px-2 py-1 border border-gray-300 rounded-md hover:bg-gray-50 mr-1">Ajustar</button>
                    <button onClick={() => openEdit(i)} className="text-gray-400 hover:text-brand-600 text-sm">&#9998;&#65039;</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {items.length === 0 && <p className="text-center text-gray-400 py-12">No hay articulos en inventario.</p>}
      </div>

      {showItemModal && (
        <Modal title={editItem ? 'Editar item' : 'Nuevo item'} onClose={() => setShowItemModal(false)}>
          <div className="space-y-3">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={itemForm.name} onChange={(e) => { setItemForm({ ...itemForm, name: e.target.value }); setItemFieldErrors((prev) => ({ ...prev, name: '' })); }} placeholder="Tomate" />
              {itemFieldErrors.name && <p className="text-xs text-red-600 mt-1">{itemFieldErrors.name}</p>}</div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Unidad *</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={itemForm.unit} onChange={(e) => { setItemForm({ ...itemForm, unit: e.target.value }); setItemFieldErrors((prev) => ({ ...prev, unit: '' })); }}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select></div>
            {itemFieldErrors.unit && <p className="text-xs text-red-600 -mt-2">{itemFieldErrors.unit}</p>}
            <div className="grid grid-cols-3 gap-2">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Stock actual</label>
                <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={itemForm.currentStock} onChange={(e) => { setItemForm({ ...itemForm, currentStock: e.target.value }); setItemFieldErrors((prev) => ({ ...prev, currentStock: '' })); }} />
                {itemFieldErrors.currentStock && <p className="text-xs text-red-600 mt-1">{itemFieldErrors.currentStock}</p>}</div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Stock minimo</label>
                <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={itemForm.minimumStock} onChange={(e) => { setItemForm({ ...itemForm, minimumStock: e.target.value }); setItemFieldErrors((prev) => ({ ...prev, minimumStock: '', minStock: '' })); }} />
                {(itemFieldErrors.minimumStock || itemFieldErrors.minStock) && <p className="text-xs text-red-600 mt-1">{itemFieldErrors.minimumStock || itemFieldErrors.minStock}</p>}</div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Costo/U</label>
                <input type="number" step="0.01" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={itemForm.costPerUnit} onChange={(e) => { setItemForm({ ...itemForm, costPerUnit: e.target.value }); setItemFieldErrors((prev) => ({ ...prev, costPerUnit: '' })); }} />
                {itemFieldErrors.costPerUnit && <p className="text-xs text-red-600 mt-1">{itemFieldErrors.costPerUnit}</p>}</div>
            </div>
            {itemFormError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{itemFormError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowItemModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={() => saveItem.mutate({ name: itemForm.name, unit: itemForm.unit, currentStock: Number(itemForm.currentStock), minimumStock: Number(itemForm.minimumStock), costPerUnit: Number(itemForm.costPerUnit) })}
                disabled={!itemForm.name || saveItem.isPending}
                className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
                {saveItem.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showAdjModal && adjItem && (
        <Modal title={`Ajustar stock: ${adjItem.name}`} onClose={() => setShowAdjModal(false)}>
          <div className="space-y-3">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={adjForm.type} onChange={(e) => { setAdjForm({ ...adjForm, type: e.target.value }); setAdjFieldErrors((prev) => ({ ...prev, type: '' })); }}>
                {ADJ_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select></div>
            {adjFieldErrors.type && <p className="text-xs text-red-600 -mt-2">{adjFieldErrors.type}</p>}
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Cantidad *</label>
              <input type="number" step="0.01" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={adjForm.quantity} onChange={(e) => { setAdjForm({ ...adjForm, quantity: e.target.value }); setAdjFieldErrors((prev) => ({ ...prev, quantity: '' })); }} placeholder="5" />
              {adjFieldErrors.quantity && <p className="text-xs text-red-600 mt-1">{adjFieldErrors.quantity}</p>}</div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={adjForm.notes} onChange={(e) => { setAdjForm({ ...adjForm, notes: e.target.value }); setAdjFieldErrors((prev) => ({ ...prev, notes: '' })); }} placeholder="Opcional" /></div>
            {adjFormError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{adjFormError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowAdjModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={() => adjustStock.mutate({ id: adjItem.id, data: { inventoryItemId: adjItem.id, quantity: Number(adjForm.quantity), type: adjForm.type, notes: adjForm.notes } })}
                disabled={!adjForm.quantity || adjustStock.isPending}
                className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
                {adjustStock.isPending ? 'Guardando...' : 'Aplicar ajuste'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

