import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import api from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth.store';
import { parseApiFormErrors } from '../../../lib/formErrors';

type Category = { id: string; name: string; description?: string; sortOrder?: number };
type Product = { id: string; name: string; price: number; isActive: boolean; imageUrl?: string; sku?: string; description?: string; categoryId?: string };

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

export default function MenuPage() {
  const { user } = useAuthStore();
  const branchId = user?.branchId ?? '';
  const qc = useQueryClient();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const [showCatModal, setShowCatModal] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [catForm, setCatForm] = useState({ name: '', description: '', sortOrder: 0 });
  const [catFormError, setCatFormError] = useState('');
  const [catFieldErrors, setCatFieldErrors] = useState<Record<string, string>>({});

  const [showProdModal, setShowProdModal] = useState(false);
  const [editProd, setEditProd] = useState<Product | null>(null);
  const [prodForm, setProdForm] = useState({ name: '', description: '', price: '', sku: '', categoryId: '', isActive: true });
  const [prodFormError, setProdFormError] = useState('');
  const [prodFieldErrors, setProdFieldErrors] = useState<Record<string, string>>({});

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories', branchId],
    queryFn: () => api.get(`/menu/categories?branchId=${branchId}`).then((r) => r.data),
    enabled: !!branchId,
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products', branchId, activeCategory],
    queryFn: () =>
      api.get(`/menu/products?branchId=${branchId}${activeCategory ? `&categoryId=${activeCategory}` : ''}`).then((r) => r.data),
    enabled: !!branchId,
  });

  const saveCat = useMutation({
    mutationFn: (data: object) =>
      editCat
        ? api.patch(`/menu/categories/${editCat.id}?branchId=${branchId}`, data, { headers: { 'X-Silent-Error': '1' } })
        : api.post(`/menu/categories?branchId=${branchId}`, data, { headers: { 'X-Silent-Error': '1' } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      setShowCatModal(false);
      setCatFormError('');
      setCatFieldErrors({});
    },
    onError: (error: any) => {
      const parsed = parseApiFormErrors(error);
      setCatFormError(parsed.global);
      setCatFieldErrors(parsed.fields);
    },
  });

  const deleteCat = useMutation({
    mutationFn: (id: string) => api.delete(`/menu/categories/${id}?branchId=${branchId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });

  const saveProd = useMutation({
    mutationFn: (data: object) =>
      editProd
        ? api.patch(`/menu/products/${editProd.id}?branchId=${branchId}`, data, { headers: { 'X-Silent-Error': '1' } })
        : api.post('/menu/products', data, { headers: { 'X-Silent-Error': '1' } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      setShowProdModal(false);
      setProdFormError('');
      setProdFieldErrors({});
    },
    onError: (error: any) => {
      const parsed = parseApiFormErrors(error);
      setProdFormError(parsed.global);
      setProdFieldErrors(parsed.fields);
    },
  });

  const deleteProd = useMutation({
    mutationFn: (id: string) => api.delete(`/menu/products/${id}?branchId=${branchId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });

  const toggleProduct = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/menu/products/${id}/toggle?branchId=${branchId}`, { isActive: !isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });

  function openNewCat() {
    setEditCat(null);
    setCatForm({ name: '', description: '', sortOrder: 0 });
    setCatFormError('');
    setCatFieldErrors({});
    setShowCatModal(true);
  }
  function openEditCat(c: Category) {
    setEditCat(c);
    setCatForm({ name: c.name, description: c.description ?? '', sortOrder: c.sortOrder ?? 0 });
    setCatFormError('');
    setCatFieldErrors({});
    setShowCatModal(true);
  }
  function openNewProd() {
    setEditProd(null);
    setProdForm({ name: '', description: '', price: '', sku: '', categoryId: activeCategory ?? '', isActive: true });
    setProdFormError('');
    setProdFieldErrors({});
    setShowProdModal(true);
  }
  function openEditProd(p: Product) {
    setEditProd(p);
    setProdForm({ name: p.name, description: p.description ?? '', price: String(p.price), sku: p.sku ?? '', categoryId: p.categoryId ?? '', isActive: p.isActive });
    setProdFormError('');
    setProdFieldErrors({});
    setShowProdModal(true);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Menú</h2>
        <div className="flex gap-2">
          <button onClick={openNewCat} className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">+ Categoría</button>
          <button onClick={openNewProd} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors">+ Producto</button>
        </div>
      </div>

      {/* Categorías */}
      <div className="flex gap-2 mb-6 flex-wrap items-center">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${!activeCategory ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-300 text-gray-600 hover:border-brand-400'}`}
        >Todos</button>
        {categories.map((c) => (
          <div key={c.id} className="flex items-center gap-1">
            <button
              onClick={() => setActiveCategory(c.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${activeCategory === c.id ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-300 text-gray-600 hover:border-brand-400'}`}
            >{c.name}</button>
            <button onClick={() => openEditCat(c)} className="text-gray-400 hover:text-brand-600 text-xs p-0.5" title="Editar">✏️</button>
            <button onClick={() => { if (confirm(`¿Eliminar categoría "${c.name}"?`)) deleteCat.mutate(c.id); }} className="text-gray-400 hover:text-red-500 text-xs p-0.5" title="Eliminar">🗑</button>
          </div>
        ))}
      </div>

      {/* Productos */}
      {products.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">🍽️</div>
          <p className="font-medium">No hay productos aún</p>
          <p className="text-sm mt-1">Haz clic en "+ Producto" para crear el primero</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4 flex gap-3">
              {p.imageUrl ? (
                <img src={p.imageUrl} alt={p.name} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center text-2xl flex-shrink-0">🍽️</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{p.name}</p>
                <p className="text-sm text-brand-600 font-semibold">${p.price}</p>
                {p.sku && <p className="text-xs text-gray-400">{p.sku}</p>}
              </div>
              <div className="flex flex-col gap-1 items-end">
                <button onClick={() => toggleProduct.mutate({ id: p.id, isActive: p.isActive })}
                  className={`text-xs px-2 py-1 rounded-full font-medium ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {p.isActive ? 'Activo' : 'Inactivo'}
                </button>
                <div className="flex gap-1 mt-auto">
                  <button onClick={() => openEditProd(p)} className="text-gray-400 hover:text-brand-600 text-xs" title="Editar">✏️</button>
                  <button onClick={() => { if (confirm(`¿Eliminar "${p.name}"?`)) deleteProd.mutate(p.id); }} className="text-gray-400 hover:text-red-500 text-xs" title="Eliminar">🗑</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Categoría */}
      {showCatModal && (
        <Modal title={editCat ? 'Editar categoría' : 'Nueva categoría'} onClose={() => setShowCatModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={catForm.name} onChange={(e) => { setCatForm({ ...catForm, name: e.target.value }); setCatFieldErrors((prev) => ({ ...prev, name: '' })); }} placeholder="Ej: Entradas" />
              {catFieldErrors.name && <p className="text-xs text-red-600 mt-1">{catFieldErrors.name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={catForm.description} onChange={(e) => { setCatForm({ ...catForm, description: e.target.value }); setCatFieldErrors((prev) => ({ ...prev, description: '' })); }} placeholder="Opcional" />
              {catFieldErrors.description && <p className="text-xs text-red-600 mt-1">{catFieldErrors.description}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Orden</label>
              <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={catForm.sortOrder} onChange={(e) => { setCatForm({ ...catForm, sortOrder: Number(e.target.value) }); setCatFieldErrors((prev) => ({ ...prev, sortOrder: '' })); }} />
              {catFieldErrors.sortOrder && <p className="text-xs text-red-600 mt-1">{catFieldErrors.sortOrder}</p>}
            </div>
            {catFormError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{catFormError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCatModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={() => saveCat.mutate(catForm)} disabled={!catForm.name || saveCat.isPending}
                className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
                {saveCat.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Producto */}
      {showProdModal && (
        <Modal title={editProd ? 'Editar producto' : 'Nuevo producto'} onClose={() => setShowProdModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={prodForm.name} onChange={(e) => { setProdForm({ ...prodForm, name: e.target.value }); setProdFieldErrors((prev) => ({ ...prev, name: '' })); }} placeholder="Ej: Tacos de pastor" />
              {prodFieldErrors.name && <p className="text-xs text-red-600 mt-1">{prodFieldErrors.name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio *</label>
              <input type="number" step="0.01" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={prodForm.price} onChange={(e) => { setProdForm({ ...prodForm, price: e.target.value }); setProdFieldErrors((prev) => ({ ...prev, price: '' })); }} placeholder="0.00" />
              {prodFieldErrors.price && <p className="text-xs text-red-600 mt-1">{prodFieldErrors.price}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={prodForm.categoryId} onChange={(e) => { setProdForm({ ...prodForm, categoryId: e.target.value }); setProdFieldErrors((prev) => ({ ...prev, categoryId: '' })); }}>
                <option value="">Sin categoría</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {prodFieldErrors.categoryId && <p className="text-xs text-red-600 mt-1">{prodFieldErrors.categoryId}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={prodForm.sku} onChange={(e) => { setProdForm({ ...prodForm, sku: e.target.value }); setProdFieldErrors((prev) => ({ ...prev, sku: '' })); }} placeholder="Opcional" />
              {prodFieldErrors.sku && <p className="text-xs text-red-600 mt-1">{prodFieldErrors.sku}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                rows={2} value={prodForm.description} onChange={(e) => { setProdForm({ ...prodForm, description: e.target.value }); setProdFieldErrors((prev) => ({ ...prev, description: '' })); }} placeholder="Opcional" />
              {prodFieldErrors.description && <p className="text-xs text-red-600 mt-1">{prodFieldErrors.description}</p>}
            </div>
            {prodFormError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{prodFormError}</p>}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="prodActive" checked={prodForm.isActive} onChange={(e) => setProdForm({ ...prodForm, isActive: e.target.checked })} className="rounded" />
              <label htmlFor="prodActive" className="text-sm text-gray-700">Activo</label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowProdModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button
                onClick={() => saveProd.mutate({ ...prodForm, price: Number(prodForm.price) })}
                disabled={!prodForm.name || !prodForm.price || !prodForm.categoryId || saveProd.isPending}
                className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
                {saveProd.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

