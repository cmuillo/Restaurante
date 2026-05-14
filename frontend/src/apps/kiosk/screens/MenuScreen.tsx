import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';
import { useKioskStore } from '../store/kiosk.store';
import type { Strings } from '../i18n/strings';
import { useSettings } from '../../../hooks/useSettings';
import { formatCurrency } from '../../../stores/settings.store';

export default function MenuScreen({ t, branchId }: { t: Strings; branchId: string }) {
  const { goTo, selectProduct, cart, customer } = useKioskStore();
  const settings = useSettings();
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const isExempt = customer?.isExempt ?? false;

  const { data: menu } = useQuery({
    queryKey: ['kiosk-menu', branchId],
    queryFn: () => api.get(`/kiosk/${branchId}/menu`).then((r) => r.data),
    enabled: !!branchId,
  });

  const categories: { id: string; name: string }[] = menu?.categories ?? [];
  const products: { id: string; name: string; price: number; taxRate?: number; imageUrl?: string; description?: string }[] = menu?.products ?? [];

  const filtered = activeCategoryId
    ? products.filter((p: any) => p.categoryId === activeCategoryId)
    : products;

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce(
    (s, i) => s + i.price * (isExempt ? 1 : (1 + i.taxRate / 100)) * i.quantity,
    0,
  );

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
            <span className="text-white font-semibold">{formatCurrency(cartTotal, settings)}</span>
          </button>
        )}
      </div>

      {customer && (
        <div className="flex items-center justify-between px-6 py-3 bg-brand-950/50 border-b border-brand-800">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⭐</span>
            <div>
              <p className="text-white font-semibold">{customer.name}</p>
              <p className="text-brand-300 text-sm">Cliente identificado: {customer.code}</p>
            </div>
          </div>
          <div className="px-4 py-2 rounded-full bg-brand-900 text-brand-200 font-bold">
            {customer.loyaltyPoints} puntos
          </div>
        </div>
      )}

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
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4 auto-rows-max">
          {filtered.map((p) => {
            const salePrice = p.price;
            return (
              <button
                key={p.id}
                onClick={() => selectProduct(p.id)}
                className="aspect-square relative overflow-hidden rounded-2xl bg-gray-800 border border-gray-700 hover:border-brand-500 active:scale-95 transition-all text-left group"
              >
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-5xl bg-gray-800">🍽️</div>
                )}
                {/* Gradient overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-8 pb-3 px-3">
                  <p className="text-sm font-semibold text-white line-clamp-2 leading-tight">{p.name}</p>
                  <p className="text-base font-bold text-brand-400 mt-0.5">{formatCurrency(salePrice, settings)}</p>
                  {p.description && <p className="text-xs text-gray-300 mt-0.5 line-clamp-2 leading-tight">{p.description}</p>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
