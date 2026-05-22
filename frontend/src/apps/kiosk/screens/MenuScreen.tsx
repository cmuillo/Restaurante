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

  const activeCategory = categories.find((c) => c.id === activeCategoryId);

  return (
    <div className="w-full h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* ── Layout principal: sidebar izq + productos der ─────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Sidebar categorías ─────────────────────────────────── */}
        <div className="w-52 flex-shrink-0 flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
          {/* Logo en el sidebar */}
          <div className="flex justify-center items-center py-5 px-3 border-b border-gray-200 dark:border-gray-700">
            {settings.logoBase64
              ? <img src={settings.logoBase64} alt={settings.restaurantName} className="h-10 object-contain" />
              : <span className="text-3xl">🍽️</span>
            }
          </div>

          {/* Lista de categorías */}
          <nav className="flex-1 py-2">
            <button
              onClick={() => setActiveCategoryId(null)}
              className={`w-full text-left px-4 py-3.5 text-base font-semibold transition-colors border-l-4 ${
                !activeCategoryId
                  ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              Todos
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCategoryId(c.id)}
                className={`w-full text-left px-4 py-3.5 text-base font-semibold transition-colors border-l-4 ${
                  activeCategoryId === c.id
                    ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400'
                    : 'border-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                {c.name}
              </button>
            ))}
          </nav>

          {/* Puntos del cliente */}
          {customer && (
            <div className="px-3 py-3 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-1.5 text-brand-600 dark:text-brand-400">
                <span className="text-lg">⭐</span>
                <span className="text-sm font-semibold">{customer.loyaltyPoints} pts</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{customer.name}</p>
            </div>
          )}
        </div>

        {/* ── Grid de productos ──────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Encabezado de categoría activa */}
          <div className="px-5 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {activeCategory?.name ?? 'Todos los productos'}
            </h2>
          </div>

          {/* Productos (scrollable) */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-max">
              {filtered.map((p) => {
                const salePrice = p.price;
                return (
                  <button
                    key={p.id}
                    onClick={() => selectProduct(p.id)}
                    className="aspect-square relative overflow-hidden rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-brand-500 active:scale-95 transition-all text-left group shadow-sm"
                  >
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-5xl bg-gray-100 dark:bg-gray-800">🍽️</div>
                    )}
                    {/* Gradient overlay */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-8 pb-3 px-3">
                      <p className="text-sm font-semibold text-white line-clamp-2 leading-tight">{p.name}</p>
                      <p className="text-base font-bold text-brand-400 mt-0.5">{formatCurrency(salePrice, settings)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom bar: Ver orden + Total ──────────────────────────── */}
      <div className="flex items-center gap-4 px-5 py-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg">
        {cartCount > 0 ? (
          <>
            <button
              onClick={() => goTo('CART')}
              className="flex items-center gap-3 flex-1 bg-brand-600 hover:bg-brand-500 active:scale-95 text-white font-bold text-lg rounded-2xl py-4 px-6 transition-all justify-center"
            >
              <span className="text-xl">🛒</span>
              <span>{t.myOrder} ({cartCount})</span>
            </button>
            <div className="text-right">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total</p>
              <p className="text-2xl font-black text-brand-600 dark:text-brand-400">
                {formatCurrency(cartTotal, settings)}
              </p>
            </div>
          </>
        ) : (
          <p className="flex-1 text-center text-gray-400 dark:text-gray-500 text-base">
            {t.empty || 'Tu carrito está vacío'}
          </p>
        )}
      </div>
    </div>
  );
}
