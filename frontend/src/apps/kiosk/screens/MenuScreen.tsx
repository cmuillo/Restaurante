import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';
import { useKioskStore } from '../store/kiosk.store';
import type { Strings } from '../i18n/strings';

export default function MenuScreen({ t, branchId }: { t: Strings; branchId: string }) {
  const { goTo, selectProduct, cart } = useKioskStore();
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  const { data: menu } = useQuery({
    queryKey: ['kiosk-menu', branchId],
    queryFn: () => api.get(`/kiosk/${branchId}/menu`).then((r) => r.data),
    enabled: !!branchId,
  });

  const categories: { id: string; name: string }[] = menu?.categories ?? [];
  const products: { id: string; name: string; price: number; imageUrl?: string; description?: string }[] = menu?.products ?? [];

  const filtered = activeCategoryId
    ? products.filter((p: any) => p.categoryId === activeCategoryId)
    : products;

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <div className="w-full h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-800 border-b border-gray-700">
        <h2 className="text-2xl font-bold text-white">{t.menu}</h2>
        {cartCount > 0 && (
          <button
            onClick={() => goTo('CART')}
            className="flex items-center gap-3 bg-brand-600 hover:bg-brand-500 active:scale-95 px-6 py-3 rounded-2xl transition-all"
          >
            <span className="text-lg">🛒</span>
            <span className="font-bold text-white">{cartCount}</span>
            <span className="text-white font-semibold">${cartTotal.toFixed(2)}</span>
          </button>
        )}
      </div>

      {/* Categorías */}
      <div className="flex gap-3 px-4 py-3 overflow-x-auto bg-gray-800 border-b border-gray-700">
        <button
          onClick={() => setActiveCategoryId(null)}
          className={`flex-shrink-0 px-5 py-2.5 rounded-2xl text-base font-semibold transition-colors ${!activeCategoryId ? 'bg-brand-600 text-white' : 'bg-gray-700 text-gray-300'}`}
        >
          Todos
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCategoryId(c.id)}
            className={`flex-shrink-0 px-5 py-2.5 rounded-2xl text-base font-semibold transition-colors ${activeCategoryId === c.id ? 'bg-brand-600 text-white' : 'bg-gray-700 text-gray-300'}`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Productos */}
      <div className="flex-1 overflow-y-auto p-4 grid grid-cols-3 gap-4">
        {filtered.map((p) => (
          <button
            key={p.id}
            onClick={() => selectProduct(p.id)}
            className="bg-gray-800 hover:bg-gray-700 active:scale-95 border border-gray-700 hover:border-brand-500 rounded-2xl p-4 text-left transition-all"
          >
            {p.imageUrl
              ? <img src={p.imageUrl} alt={p.name} className="w-full h-32 object-cover rounded-xl mb-3" />
              : <div className="w-full h-32 bg-gray-700 rounded-xl mb-3 flex items-center justify-center text-5xl">🍽️</div>}
            <p className="text-base font-semibold text-white line-clamp-2">{p.name}</p>
            <p className="text-xl font-bold text-brand-400 mt-1">${p.price}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
