import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import api from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth.store';

export default function MenuPage() {
  const { user } = useAuthStore();
  const branchId = user?.branchId ?? '';
  const qc = useQueryClient();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', branchId],
    queryFn: () => api.get(`/menu/categories?branchId=${branchId}`).then((r) => r.data),
    enabled: !!branchId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products', branchId, activeCategory],
    queryFn: () =>
      api
        .get(`/menu/products?branchId=${branchId}${activeCategory ? `&categoryId=${activeCategory}` : ''}`)
        .then((r) => r.data),
    enabled: !!branchId,
  });

  const toggleProduct = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/menu/products/${id}`, { isActive: !isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Menú</h2>

      {/* Categorías */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
            !activeCategory ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-300 text-gray-600 hover:border-brand-400'
          }`}
        >
          Todos
        </button>
        {categories.map((c: { id: string; name: string }) => (
          <button
            key={c.id}
            onClick={() => setActiveCategory(c.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              activeCategory === c.id ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-300 text-gray-600 hover:border-brand-400'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Productos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((p: { id: string; name: string; price: number; isActive: boolean; imageUrl?: string; sku?: string }) => (
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
            <button
              onClick={() => toggleProduct.mutate({ id: p.id, isActive: p.isActive })}
              className={`self-start text-xs px-2 py-1 rounded-full font-medium ${
                p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {p.isActive ? 'Activo' : 'Inactivo'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
