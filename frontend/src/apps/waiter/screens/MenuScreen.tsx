import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import waiterApi from '../lib/waiter-api';
import { useWaiterStore } from '../store/waiter.store';
import { useSettings } from '../../../hooks/useSettings';
import { formatCurrency } from '../../../stores/settings.store';

interface MenuProduct {
  id: string;
  name: string;
  description: string | null;
  price: string;
  imageBase64: string | null;
  isActive: boolean;
  categoryId: string;
}

interface MenuCategory {
  id: string;
  name: string;
}

interface MenuData {
  branchConfig: { taxPercentage: number };
  categories: MenuCategory[];
  products: MenuProduct[];
}

export default function MenuScreen() {
  const { user, cart, selectProduct, goTo, selectedTable } =
    useWaiterStore();
  const settings = useSettings();
  const branchId = user?.branchId ?? '';

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { data: menu } = useQuery<MenuData>({
    queryKey: ['waiter-menu', branchId],
    queryFn: () => waiterApi.get(`/waiter/${branchId}/menu`).then((r) => r.data),
    enabled: !!branchId,
  });

  const categories = menu?.categories ?? [];
  const allProducts = menu?.products ?? [];

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allProducts.filter((p) => {
      if (!p.isActive) return false;
      if (selectedCategoryId && p.categoryId !== selectedCategoryId) return false;
      if (q && !p.name.toLowerCase().includes(q) && !(p.description ?? '').toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [allProducts, selectedCategoryId, search]);

  const cartCount = cart.reduce((a, i) => a + i.quantity, 0);
  const cartTotal = cart.reduce((a, i) => a + i.price * (1 + i.taxRate / 100) * i.quantity, 0);

  const contextLabel = selectedTable?.id ? `Mesa ${selectedTable.number}` : 'Para llevar';

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
        <button
          onClick={() => goTo('CUSTOMER')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-700 text-sm font-semibold transition-all shrink-0"
        >
          ‹ Volver
        </button>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar producto…"
          className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <span className="text-xs text-gray-400 shrink-0">{contextLabel}</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar categorías */}
        <div className="w-20 flex flex-col bg-white border-r border-gray-100 overflow-y-auto shrink-0">
          <button
            onClick={() => setSelectedCategoryId(null)}
            className={`px-1 py-3 text-center text-xs font-semibold border-b border-gray-100 transition-colors ${
              selectedCategoryId === null
                ? 'bg-brand-50 text-brand-700'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            Todo
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`px-1 py-3 text-center text-xs font-semibold border-b border-gray-100 transition-colors leading-tight ${
                selectedCategoryId === cat.id
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Grilla de productos */}
        <div className="flex-1 overflow-y-auto p-3 pb-28">
          {filteredProducts.length === 0 ? (
            <p className="text-center text-gray-400 mt-16">Sin resultados</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredProducts.map((product) => {
                const inCart = cart.filter((c) => c.productId === product.id).reduce((a, i) => a + i.quantity, 0);
                return (
                  <button
                    key={product.id}
                    onClick={() => selectProduct(product.id)}
                    className="relative flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden active:scale-95 transition-all text-left"
                  >
                    {product.imageBase64 ? (
                      <img
                        src={product.imageBase64}
                        alt={product.name}
                        className="w-full h-28 object-cover"
                      />
                    ) : (
                      <div className="w-full h-28 bg-gray-100 flex items-center justify-center text-3xl">
                        🍽️
                      </div>
                    )}
                    {inCart > 0 && (
                      <span className="absolute top-2 right-2 bg-brand-600 text-white text-xs font-black rounded-full w-6 h-6 flex items-center justify-center">
                        {inCart}
                      </span>
                    )}
                    <div className="p-2 flex flex-col gap-0.5">
                      <p className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2">
                        {product.name}
                      </p>
                      <p className="text-sm font-bold text-brand-600">
                        {formatCurrency(parseFloat(product.price), settings)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Barra inferior — Ver orden */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-safe bg-white border-t border-gray-100 shadow-lg py-3">
          <button
            onClick={() => goTo('CART')}
            className="w-full bg-brand-600 hover:bg-brand-500 active:scale-95 text-white font-bold rounded-2xl py-4 flex items-center justify-between px-5 text-base transition-all"
          >
            <span className="bg-white/20 rounded-lg px-2 py-0.5 text-sm font-black">
              {cartCount}
            </span>
            <span>Ver orden</span>
            <span>{formatCurrency(cartTotal, settings)}</span>
          </button>
        </div>
      )}
    </div>
  );
}
