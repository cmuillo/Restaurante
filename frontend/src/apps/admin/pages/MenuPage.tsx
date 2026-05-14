import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import api from '../../../lib/api';
import { useActiveBranchId } from '../../../hooks/useActiveBranchId';
import { useSettings } from '../../../hooks/useSettings';
import { formatCurrency } from '../../../stores/settings.store';
import { parseApiFormErrors } from '../../../lib/formErrors';

type Category = { id: string; name: string; description?: string; sortOrder?: number };
type Product = {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  imageUrl?: string;
  sku?: string;
  description?: string;
  categoryId?: string;
  allergens?: string[];
  pointsPerPurchase?: number;
  showInKiosk?: boolean;
  cabysCode?: string;
  commercialCodeType?: string;
  commercialCode?: string;
  taxCode?: string;
  taxRate?: number;
  unitOfMeasure?: string;
};

type CabysCatalogItem = {
  code: string;
  name: string;
  suggestedTaxRate: number;
  suggestedTaxCode: string;
  suggestedUnitOfMeasure: string;
};

const CABYS_FALLBACK: CabysCatalogItem[] = [
  {
    code: '561101',
    name: 'Restaurantes con servicio completo',
    suggestedTaxRate: 13,
    suggestedTaxCode: '01',
    suggestedUnitOfMeasure: 'Sp',
  },
  {
    code: '561102',
    name: 'Restaurantes con servicio limitado',
    suggestedTaxRate: 13,
    suggestedTaxCode: '01',
    suggestedUnitOfMeasure: 'Sp',
  },
  {
    code: '561103',
    name: 'Bares, cantinas, discotecas',
    suggestedTaxRate: 13,
    suggestedTaxCode: '01',
    suggestedUnitOfMeasure: 'Sp',
  },
  {
    code: '561104',
    name: 'Cafeterias y restaurantes de comida rapida',
    suggestedTaxRate: 13,
    suggestedTaxCode: '01',
    suggestedUnitOfMeasure: 'Sp',
  },
  {
    code: '561105',
    name: 'Panaderia y confiteria',
    suggestedTaxRate: 13,
    suggestedTaxCode: '01',
    suggestedUnitOfMeasure: 'Sp',
  },
  {
    code: '561106',
    name: 'Otros servicios de alimentacion',
    suggestedTaxRate: 13,
    suggestedTaxCode: '01',
    suggestedUnitOfMeasure: 'Sp',
  },
];

function Modal({
  title,
  icon,
  onClose,
  children,
  size = 'md',
}: {
  title: string;
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'md' | 'xl';
}) {
  const widthClass = size === 'xl' ? 'max-w-5xl' : 'max-w-xl';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`bg-[var(--color-bg-secondary,#1e2435)] border border-white/10 rounded-2xl shadow-2xl w-full ${widthClass} max-h-[92vh] overflow-hidden m-4`}
        onClick={(e) => e.stopPropagation()}
      >
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
        <div className="px-6 py-5 overflow-y-auto max-h-[78vh]">{children}</div>
      </div>
    </div>
  );
}

export default function MenuPage() {
  const branchId = useActiveBranchId();
  const qc = useQueryClient();
  const settings = useSettings();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');

  const [showCatModal, setShowCatModal] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [catForm, setCatForm] = useState({ name: '', description: '', sortOrder: 0 });
  const [catFormError, setCatFormError] = useState('');
  const [catFieldErrors, setCatFieldErrors] = useState<Record<string, string>>({});

  const [showProdModal, setShowProdModal] = useState(false);
  const [editProd, setEditProd] = useState<Product | null>(null);
  const [cabysQuery, setCabysQuery] = useState('');
  const [prodForm, setProdForm] = useState({
    name: '',
    description: '',
    price: '',
    salePrice: '',
    sku: '',
    categoryId: '',
    imageUrl: '',
    allergensText: '',
    pointsPerPurchase: '',
    isActive: true,
    showInKiosk: true,
    cabysCode: '',
    commercialCodeType: '04',
    commercialCode: '',
    taxCode: '01',
    taxRate: '',
    unitOfMeasure: 'Sp',
  });
  const [prodFormError, setProdFormError] = useState('');
  const [prodFieldErrors, setProdFieldErrors] = useState<Record<string, string>>({});
  const [imageUploadError, setImageUploadError] = useState('');

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

  const { data: cabysCatalog = [] } = useQuery<CabysCatalogItem[]>({
    queryKey: ['cabysCatalog', cabysQuery],
    queryFn: () =>
      api
        .get(`/hacienda/cabys-codes?search=${encodeURIComponent(cabysQuery)}`)
        .then((res) => res.data),
    enabled: showProdModal,
  });

  const filteredCabys = useMemo(() => {
    const source = cabysCatalog.length > 0 ? cabysCatalog : CABYS_FALLBACK;
    const q = cabysQuery.trim().toLowerCase();
    if (!q) return source;
    return source.filter((item) =>
      item.code.includes(q) || item.name.toLowerCase().includes(q),
    );
  }, [cabysCatalog, cabysQuery]);

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
    setCabysQuery('');
    setImageUploadError('');
    setProdForm({
      name: '',
      description: '',
      price: '',
      salePrice: '',
      sku: '',
      categoryId: activeCategory ?? '',
      imageUrl: '',
      allergensText: '',
      pointsPerPurchase: '',
      isActive: true,
      showInKiosk: true,
      cabysCode: '',
      commercialCodeType: '04',
      commercialCode: '',
      taxCode: '01',
      taxRate: '',
      unitOfMeasure: 'Sp',
    });
    setProdFormError('');
    setProdFieldErrors({});
    setShowProdModal(true);
  }
  function openEditProd(p: Product) {
    setEditProd(p);
    setCabysQuery(p.cabysCode ?? '');
    const taxRateNum = p.taxRate ?? 0;
    const salePriceNum = Number(p.price);
    const basePriceNum = taxRateNum > 0 ? salePriceNum / (1 + taxRateNum / 100) : salePriceNum;
    setImageUploadError('');
    setProdForm({
      name: p.name,
      description: p.description ?? '',
      price: basePriceNum.toFixed(2),
      salePrice: salePriceNum.toFixed(2),
      sku: p.sku ?? '',
      categoryId: p.categoryId ?? '',
      imageUrl: p.imageUrl ?? '',
      allergensText: (p.allergens ?? []).join(', '),
      pointsPerPurchase: p.pointsPerPurchase === undefined ? '' : String(p.pointsPerPurchase),
      isActive: p.isActive,
      showInKiosk: p.showInKiosk ?? true,
      cabysCode: p.cabysCode ?? '',
      commercialCodeType: p.commercialCodeType ?? '04',
      commercialCode: p.commercialCode ?? '',
      taxCode: p.taxCode ?? '01',
      taxRate: p.taxRate == null ? '' : String(p.taxRate),
      unitOfMeasure: p.unitOfMeasure ?? 'Sp',
    });
    setProdFormError('');
    setProdFieldErrors({});
    setShowProdModal(true);
  }

  function applyCabysSuggestion(item: CabysCatalogItem) {
    setProdForm((prev) => {
      const newTaxRate = String(item.suggestedTaxRate);
      const sp = Number(prev.salePrice);
      const newBase =
        prev.salePrice !== '' && !isNaN(sp) && item.suggestedTaxRate > 0
          ? (sp / (1 + item.suggestedTaxRate / 100)).toFixed(2)
          : prev.price;
      return {
        ...prev,
        cabysCode: item.code,
        taxCode: item.suggestedTaxCode,
        taxRate: newTaxRate,
        unitOfMeasure: item.suggestedUnitOfMeasure,
        price: newBase,
      };
    });
    setCabysQuery(item.code);
    setProdFieldErrors((prev) => ({ ...prev, cabysCode: '' }));
  }

  function handleSaveProd() {
    if (!prodForm.salePrice) {
      setProdFormError('Introduce el precio de venta del producto.');
      return;
    }
    if (!prodForm.categoryId) {
      setProdFormError('Selecciona una categoría.');
      return;
    }
    setProdFormError('');
    saveProd.mutate(buildProductPayload());
  }

  function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1 * 1024 * 1024) {
      setImageUploadError('La imagen debe ser menor a 1 MB.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setImageUploadError('Solo se permiten imágenes (jpg, png, webp...).');
      return;
    }
    setImageUploadError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      setProdForm((prev) => ({ ...prev, imageUrl: ev.target?.result as string }));
    };
    reader.readAsDataURL(file);
    // reset input so same file can be re-selected
    e.target.value = '';
  }

  function buildProductPayload() {
    const allergens = prodForm.allergensText
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);

    return {
      name: prodForm.name,
      description: prodForm.description || undefined,
      price: Number(prodForm.salePrice),
      sku: prodForm.sku || undefined,
      categoryId: prodForm.categoryId,
      imageUrl: prodForm.imageUrl || undefined,
      allergens,
      pointsPerPurchase: prodForm.pointsPerPurchase === '' ? 0 : Number(prodForm.pointsPerPurchase),
      isActive: prodForm.isActive,
      showInKiosk: prodForm.showInKiosk,
      cabysCode: prodForm.cabysCode || undefined,
      commercialCodeType: prodForm.commercialCodeType || undefined,
      commercialCode: prodForm.commercialCode || undefined,
      taxCode: prodForm.taxCode || undefined,
      taxRate: prodForm.taxRate === '' ? undefined : Number(prodForm.taxRate),
      unitOfMeasure: prodForm.unitOfMeasure || undefined,
    };
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
            <button onClick={() => openEditCat(c)} className="text-gray-400 hover:text-brand-600 text-base sm:text-lg p-1 leading-none" title="Editar">✏️</button>
            <button onClick={() => { if (confirm(`¿Eliminar categoría "${c.name}"?`)) deleteCat.mutate(c.id); }} className="text-gray-400 hover:text-red-500 text-base sm:text-lg p-1 leading-none" title="Eliminar">🗑</button>
          </div>
        ))}
      </div>

      {/* Filtro estado productos */}
      <div className="flex gap-2 mb-4 items-center">
        <span className="text-xs text-gray-500 font-medium">Estado:</span>
        <button
          onClick={() => setStatusFilter('active')}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${statusFilter === 'active' ? 'bg-green-600 text-white border-green-600' : 'border-gray-300 text-gray-600 hover:border-green-400'}`}
        >Activos</button>
        <button
          onClick={() => setStatusFilter('inactive')}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${statusFilter === 'inactive' ? 'bg-gray-500 text-white border-gray-500' : 'border-gray-300 text-gray-600 hover:border-gray-400'}`}
        >Inactivos</button>
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${statusFilter === 'all' ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-300 text-gray-600 hover:border-brand-400'}`}
        >Todos</button>
      </div>

      {/* Productos */}
      {(() => {
        const filtered = products.filter((p) =>
          statusFilter === 'all' ? true : statusFilter === 'active' ? p.isActive : !p.isActive
        );
        return filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">🍽️</div>
          <p className="font-medium">{statusFilter === 'inactive' ? 'No hay productos inactivos' : statusFilter === 'active' ? 'No hay productos activos' : 'No hay productos aún'}</p>
          {statusFilter !== 'inactive' && <p className="text-sm mt-1">Haz clic en "+ Producto" para crear el primero</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4 flex gap-3">
              {p.imageUrl ? (
                <img src={p.imageUrl} alt={p.name} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center text-2xl flex-shrink-0">🍽️</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{p.name}</p>
                <p className="text-sm text-brand-600 font-semibold">{formatCurrency(p.price, settings)}</p>
                {p.sku && <p className="text-xs text-gray-400">Cod: {p.sku}</p>}
                {p.cabysCode && <p className="text-[11px] text-gray-500">CABYS: {p.cabysCode}</p>}
                {p.showInKiosk === false && <p className="text-[11px] text-amber-600">No visible en kiosko</p>}
              </div>
              <div className="flex flex-col gap-1 items-end">
                <button onClick={() => toggleProduct.mutate({ id: p.id, isActive: p.isActive })}
                  className={`text-xs px-2 py-1 rounded-full font-medium ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {p.isActive ? 'Activo' : 'Inactivo'}
                </button>
                <div className="flex gap-1 mt-auto">
                  <button onClick={() => openEditProd(p)} className="text-gray-400 hover:text-brand-600 text-base sm:text-lg p-1 leading-none" title="Editar">✏️</button>
                  <button onClick={() => { if (confirm(`¿Eliminar "${p.name}"?`)) deleteProd.mutate(p.id); }} className="text-gray-400 hover:text-red-500 text-base sm:text-lg p-1 leading-none" title="Eliminar">🗑</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
      })()}

      {/* Modal Categoría */}
      {showCatModal && (
        <Modal title={editCat ? 'Editar categoría' : 'Nueva categoría'} icon="🏷️" onClose={() => setShowCatModal(false)} size="md">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Nombre <span className="text-red-400">*</span></label>
              <input
                className={`w-full bg-white/5 border ${catFieldErrors.name ? 'border-red-500' : 'border-white/10'} rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition`}
                value={catForm.name}
                onChange={(e) => { setCatForm({ ...catForm, name: e.target.value }); setCatFieldErrors((prev) => ({ ...prev, name: '' })); }}
                placeholder="Ej: Entradas"
              />
              {catFieldErrors.name && <p className="text-xs text-red-400 mt-1">{catFieldErrors.name}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Descripción</label>
              <input
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                value={catForm.description}
                onChange={(e) => { setCatForm({ ...catForm, description: e.target.value }); setCatFieldErrors((prev) => ({ ...prev, description: '' })); }}
                placeholder="Opcional"
              />
              {catFieldErrors.description && <p className="text-xs text-red-400 mt-1">{catFieldErrors.description}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Orden</label>
              <input
                type="number"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                value={catForm.sortOrder}
                onChange={(e) => { setCatForm({ ...catForm, sortOrder: Number(e.target.value) }); setCatFieldErrors((prev) => ({ ...prev, sortOrder: '' })); }}
              />
              {catFieldErrors.sortOrder && <p className="text-xs text-red-400 mt-1">{catFieldErrors.sortOrder}</p>}
            </div>
            {catFormError && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                <span className="text-red-400 text-sm flex-shrink-0">⚠</span>
                <p className="text-sm text-red-400">{catFormError}</p>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => setShowCatModal(false)} className="px-5 py-2.5 text-sm font-medium border border-white/15 text-gray-300 rounded-xl hover:bg-white/5 transition-colors">Cancelar</button>
              <button
                onClick={() => saveCat.mutate(catForm)}
                disabled={!catForm.name || saveCat.isPending}
                className="px-5 py-2.5 text-sm font-semibold bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saveCat.isPending ? (
                  <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Guardando...</span>
                ) : (
                  editCat ? 'Guardar cambios' : 'Crear categoría'
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Producto */}
      {showProdModal && (
        <Modal title={editProd ? 'Editar producto' : 'Nuevo producto'} icon="🍽️" onClose={() => setShowProdModal(false)} size="xl">
          <div className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Columna izquierda */}
              <div className="space-y-4">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">Datos básicos</p>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Nombre <span className="text-red-400">*</span></label>
                  <input
                    className={`w-full bg-white/5 border ${prodFieldErrors.name ? 'border-red-500' : 'border-white/10'} rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition`}
                    value={prodForm.name}
                    onChange={(e) => { setProdForm({ ...prodForm, name: e.target.value }); setProdFieldErrors((prev) => ({ ...prev, name: '' })); }}
                    placeholder="Ej: Tacos de pastor"
                  />
                  {prodFieldErrors.name && <p className="text-xs text-red-400 mt-1">{prodFieldErrors.name}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Precio de venta (con IVA) <span className="text-red-400">*</span></label>
                    <input
                      type="number" step="0.01"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                      value={prodForm.salePrice}
                      onChange={(e) => {
                        const sp = e.target.value;
                        const tax = Number(prodForm.taxRate) || 0;
                        const base = sp !== '' && !isNaN(Number(sp))
                          ? (Number(sp) / (1 + tax / 100)).toFixed(2)
                          : '';
                        setProdForm((prev) => ({ ...prev, salePrice: sp, price: base }));
                        setProdFieldErrors((prev) => ({ ...prev, price: '' }));
                      }}
                      placeholder="Ej: 2034"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Precio base (sin IVA)</label>
                    <input
                      type="number" step="0.01"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-500 cursor-not-allowed"
                      value={prodForm.price}
                      readOnly
                      placeholder="Calculado automático"
                    />
                    {prodFieldErrors.price && <p className="text-xs text-red-400 mt-1">{prodFieldErrors.price}</p>}
                    <p className="text-[11px] text-gray-500 mt-0.5">Calculado: precio de venta ÷ (1 + IVA%)</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Categoría</label>
                    <select
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                      value={prodForm.categoryId}
                      onChange={(e) => { setProdForm({ ...prodForm, categoryId: e.target.value }); setProdFieldErrors((prev) => ({ ...prev, categoryId: '' })); }}
                    >
                      <option value="">Sin categoría</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    {prodFieldErrors.categoryId && <p className="text-xs text-red-400 mt-1">{prodFieldErrors.categoryId}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Código / SKU</label>
                    <input
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                      value={prodForm.sku}
                      onChange={(e) => { setProdForm({ ...prodForm, sku: e.target.value }); setProdFieldErrors((prev) => ({ ...prev, sku: '' })); }}
                      placeholder="Opcional"
                    />
                    {prodFieldErrors.sku && <p className="text-xs text-red-400 mt-1">{prodFieldErrors.sku}</p>}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Imagen del producto</label>
                  {prodForm.imageUrl ? (
                    <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl">
                      <img src={prodForm.imageUrl} alt="preview" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                      <div className="flex flex-col gap-1.5">
                        <label className="cursor-pointer px-3 py-1.5 text-xs font-medium bg-white/10 text-gray-200 hover:bg-white/20 rounded-lg inline-block transition-colors">
                          Cambiar imagen
                          <input type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
                        </label>
                        <button type="button" onClick={() => { setProdForm((p) => ({ ...p, imageUrl: '' })); setImageUploadError(''); }} className="text-xs text-red-400 hover:text-red-300 text-left transition-colors">Eliminar imagen</button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex items-center gap-3 cursor-pointer border border-dashed border-white/20 rounded-xl px-4 py-3 hover:border-brand-400 hover:bg-white/5 transition-colors">
                      <span className="text-2xl">📷</span>
                      <div>
                        <p className="text-sm font-medium text-gray-300">Seleccionar imagen</p>
                        <p className="text-xs text-gray-500">JPG, PNG, WEBP — máximo 1 MB</p>
                      </div>
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
                    </label>
                  )}
                  {imageUploadError && <p className="text-xs text-red-400 mt-1">{imageUploadError}</p>}
                  {prodFieldErrors.imageUrl && <p className="text-xs text-red-400 mt-1">{prodFieldErrors.imageUrl}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Alergenos</label>
                  <input
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                    value={prodForm.allergensText}
                    onChange={(e) => { setProdForm({ ...prodForm, allergensText: e.target.value }); setProdFieldErrors((prev) => ({ ...prev, allergens: '' })); }}
                    placeholder="gluten, lactosa, nueces"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">Separar por comas para cumplimiento informativo al consumidor.</p>
                  {prodFieldErrors.allergens && <p className="text-xs text-red-400 mt-1">{prodFieldErrors.allergens}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Puntos por compra</label>
                  <input
                    type="number" min="0" step="1"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                    value={prodForm.pointsPerPurchase}
                    onChange={(e) => { setProdForm({ ...prodForm, pointsPerPurchase: e.target.value }); setProdFieldErrors((prev) => ({ ...prev, pointsPerPurchase: '' })); }}
                    placeholder="0"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">Puntos que gana el cliente por cada unidad comprada</p>
                  {prodFieldErrors.pointsPerPurchase && <p className="text-xs text-red-400 mt-1">{prodFieldErrors.pointsPerPurchase}</p>}
                </div>
              </div>

              {/* Columna derecha */}
              <div className="space-y-4">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">Datos fiscales (Hacienda)</p>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Código CABYS</label>
                  {prodForm.cabysCode && (
                    <div className="flex items-start gap-2 bg-brand-600/10 border border-brand-500/20 rounded-lg px-2 py-1.5 mb-2">
                      <span className="text-brand-400 mt-px">✓</span>
                      <div>
                        <p className="text-xs font-mono text-brand-400">{prodForm.cabysCode}</p>
                        <p className="text-[10px] text-brand-300/70 mt-0.5">
                          Auto: IVA {prodForm.taxRate || '—'}% · {prodForm.unitOfMeasure} · Cód. imp. {prodForm.taxCode}
                        </p>
                      </div>
                    </div>
                  )}
                  <input
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                    value={cabysQuery}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCabysQuery(v);
                      setProdForm((prev) => ({ ...prev, cabysCode: v }));
                      setProdFieldErrors((prev) => ({ ...prev, cabysCode: '' }));
                    }}
                    placeholder="Buscar por código o nombre de CABYS"
                  />
                  <div className="mt-2 border border-white/10 rounded-xl max-h-32 overflow-y-auto bg-white/5">
                    {filteredCabys.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-gray-500">No se encontraron codigos CABYS para la busqueda.</p>
                    ) : (
                      filteredCabys.map((item) => (
                        <button
                          key={item.code}
                          type="button"
                          onClick={() => applyCabysSuggestion(item)}
                          className="w-full text-left px-3 py-2 hover:bg-white/10 border-b border-white/5 last:border-b-0 transition-colors"
                        >
                          <p className="text-xs font-semibold text-brand-400">{item.code}</p>
                          <p className="text-xs text-gray-400 truncate">{item.name}</p>
                        </button>
                      ))
                    )}
                  </div>
                  {prodFieldErrors.cabysCode && <p className="text-xs text-red-400 mt-1">{prodFieldErrors.cabysCode}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Unidad de medida</label>
                    <select
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                      value={prodForm.unitOfMeasure}
                      onChange={(e) => { setProdForm({ ...prodForm, unitOfMeasure: e.target.value }); setProdFieldErrors((prev) => ({ ...prev, unitOfMeasure: '' })); }}
                    >
                      <option value="Sp">Sp - Servicio</option>
                      <option value="Unid">Unid - Unidad</option>
                      <option value="kg">kg - Kilogramo</option>
                      <option value="L">L - Litro</option>
                    </select>
                    {prodFieldErrors.unitOfMeasure && <p className="text-xs text-red-400 mt-1">{prodFieldErrors.unitOfMeasure}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Impuesto (%)</label>
                    <input
                      type="number" step="0.01"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                      value={prodForm.taxRate}
                      onChange={(e) => {
                        const tax = e.target.value;
                        const sp = Number(prodForm.salePrice);
                        const base = prodForm.salePrice !== '' && !isNaN(sp) && Number(tax) > 0
                          ? (sp / (1 + Number(tax) / 100)).toFixed(2)
                          : prodForm.price;
                        setProdForm((prev) => ({ ...prev, taxRate: tax, price: base }));
                        setProdFieldErrors((prev) => ({ ...prev, taxRate: '' }));
                      }}
                      placeholder="13"
                    />
                    {prodFieldErrors.taxRate && <p className="text-xs text-red-400 mt-1">{prodFieldErrors.taxRate}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Tipo cod. comercial</label>
                    <select
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                      value={prodForm.commercialCodeType}
                      onChange={(e) => { setProdForm({ ...prodForm, commercialCodeType: e.target.value }); setProdFieldErrors((prev) => ({ ...prev, commercialCodeType: '' })); }}
                    >
                      <option value="01">01 — Cód. barras (EAN)</option>
                      <option value="02">02 — Farmacéutico</option>
                      <option value="03">03 — Ministerio</option>
                      <option value="04">04 — Interno</option>
                      <option value="05">05 — CUP</option>
                      <option value="99">99 — Otros</option>
                    </select>
                    {prodFieldErrors.commercialCodeType && <p className="text-xs text-red-400 mt-1">{prodFieldErrors.commercialCodeType}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Cod. comercial</label>
                    <input
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                      value={prodForm.commercialCode}
                      onChange={(e) => { setProdForm({ ...prodForm, commercialCode: e.target.value }); setProdFieldErrors((prev) => ({ ...prev, commercialCode: '' })); }}
                      placeholder="Codigo interno/fiscal"
                    />
                    {prodFieldErrors.commercialCode && <p className="text-xs text-red-400 mt-1">{prodFieldErrors.commercialCode}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Código impuesto</label>
                    <select
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                      value={prodForm.taxCode}
                      onChange={(e) => { setProdForm({ ...prodForm, taxCode: e.target.value }); setProdFieldErrors((prev) => ({ ...prev, taxCode: '' })); }}
                    >
                      <option value="01">01 — IVA</option>
                      <option value="02">02 — Imp. Selectivo</option>
                      <option value="07">07 — IVA especial</option>
                      <option value="99">99 — Otros</option>
                    </select>
                    {prodFieldErrors.taxCode && <p className="text-xs text-red-400 mt-1">{prodFieldErrors.taxCode}</p>}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-white/8" />

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Descripción</label>
              <textarea
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition resize-none"
                rows={2}
                value={prodForm.description}
                onChange={(e) => { setProdForm({ ...prodForm, description: e.target.value }); setProdFieldErrors((prev) => ({ ...prev, description: '' })); }}
                placeholder="Descripción opcional del producto"
              />
              {prodFieldErrors.description && <p className="text-xs text-red-400 mt-1">{prodFieldErrors.description}</p>}
            </div>

            {prodFormError && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                <span className="text-red-400 text-sm flex-shrink-0">⚠</span>
                <p className="text-sm text-red-400">{prodFormError}</p>
              </div>
            )}

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={prodForm.isActive} onChange={(e) => setProdForm({ ...prodForm, isActive: e.target.checked })} className="w-4 h-4 rounded accent-brand-500" />
                <span className="text-sm text-gray-300">Activo</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={prodForm.showInKiosk} onChange={(e) => setProdForm({ ...prodForm, showInKiosk: e.target.checked })} className="w-4 h-4 rounded accent-brand-500" />
                <span className="text-sm text-gray-300">Mostrar en kiosko</span>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => setShowProdModal(false)} className="px-5 py-2.5 text-sm font-medium border border-white/15 text-gray-300 rounded-xl hover:bg-white/5 transition-colors">Cancelar</button>
              <button
                onClick={handleSaveProd}
                disabled={!prodForm.name || saveProd.isPending}
                className="px-5 py-2.5 text-sm font-semibold bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saveProd.isPending ? (
                  <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Guardando...</span>
                ) : (
                  editProd ? 'Guardar cambios' : 'Crear producto'
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

