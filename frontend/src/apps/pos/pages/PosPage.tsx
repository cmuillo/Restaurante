import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth.store';

interface CartItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
}

export default function PosPage() {
  const { user, logout } = useAuthStore();
  const branchId = user?.branchId ?? '';
  const qc = useQueryClient();

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<'DINE_IN' | 'TO_GO' | 'DELIVERY'>('DINE_IN');
  const [tableId, setTableId] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const { data: categories = [] } = useQuery({
    queryKey: ['pos-categories', branchId],
    queryFn: () => api.get(`/menu/categories?branchId=${branchId}`).then((r) => r.data),
    enabled: !!branchId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['pos-products', branchId, activeCategory],
    queryFn: () =>
      api.get(`/menu/products?branchId=${branchId}${activeCategory ? `&categoryId=${activeCategory}` : ''}`).then((r) => r.data),
    enabled: !!branchId,
  });

  const { data: tables = [] } = useQuery({
    queryKey: ['pos-tables', branchId],
    queryFn: () => api.get(`/tables?branchId=${branchId}`).then((r) => r.data),
    enabled: !!branchId && orderType === 'DINE_IN',
  });

  const addToCart = (product: { id: string; name: string; price: number }) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) return prev.map((i) => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { productId: product.id, productName: product.name, price: product.price, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => {
      const item = prev.find((i) => i.productId === productId);
      if (!item) return prev;
      if (item.quantity <= 1) return prev.filter((i) => i.productId !== productId);
      return prev.map((i) => i.productId === productId ? { ...i, quantity: i.quantity - 1 } : i);
    });
  };

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  const placeOrder = useMutation({
    mutationFn: () =>
      api.post('/orders', {
        branchId,
        type: orderType,
        tableId: orderType === 'DINE_IN' && tableId ? tableId : undefined,
        items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity, modifiers: [] })),
      }),
    onSuccess: () => {
      setCart([]);
      setSuccessMsg('¡Orden enviada a cocina!');
      setTimeout(() => setSuccessMsg(''), 3000);
      qc.invalidateQueries({ queryKey: ['pos-tables'] });
    },
  });

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Panel de productos */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <span className="font-bold text-lg">🍴 POS</span>
          <div className="flex gap-2">
            {['DINE_IN', 'TO_GO', 'DELIVERY'].map((t) => (
              <button key={t} onClick={() => setOrderType(t as typeof orderType)}
                className={`px-3 py-1 rounded-full text-xs font-medium ${orderType === t ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {t === 'DINE_IN' ? 'Mesa' : t === 'TO_GO' ? 'Para llevar' : 'Delivery'}
              </button>
            ))}
          </div>
          <button onClick={() => logout()} className="text-xs text-red-500">Salir</button>
        </div>

        {/* Categorías */}
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex gap-2 overflow-x-auto">
          <button onClick={() => setActiveCategory(null)}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium ${!activeCategory ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            Todos
          </button>
          {categories.map((c: { id: string; name: string }) => (
            <button key={c.id} onClick={() => setActiveCategory(c.id)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium ${activeCategory === c.id ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {c.name}
            </button>
          ))}
        </div>

        {/* Productos */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3 content-start">
          {products.filter((p: { isActive: boolean }) => p.isActive).map((p: { id: string; name: string; price: number; imageUrl?: string }) => (
            <button key={p.id} onClick={() => addToCart(p)}
              className="bg-white rounded-xl border border-gray-200 p-3 text-left hover:shadow-md hover:border-brand-400 active:scale-95 transition-all">
              {p.imageUrl
                ? <img src={p.imageUrl} alt={p.name} className="w-full h-20 object-cover rounded-lg mb-2" />
                : <div className="w-full h-20 bg-gray-100 rounded-lg mb-2 flex items-center justify-center text-3xl">🍽️</div>}
              <p className="text-xs font-medium text-gray-800 line-clamp-2">{p.name}</p>
              <p className="text-sm font-bold text-brand-600 mt-0.5">${p.price}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Panel de carrito */}
      <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-bold text-gray-800">Orden actual</h2>
          {orderType === 'DINE_IN' && (
            <select value={tableId} onChange={(e) => setTableId(e.target.value)}
              className="mt-2 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="">Seleccionar mesa…</option>
              {tables.filter((t: { status: string }) => t.status === 'FREE').map((t: { id: string; number: number }) => (
                <option key={t.id} value={t.id}>Mesa {t.number}</option>
              ))}
            </select>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cart.length === 0 && <p className="text-gray-400 text-sm text-center mt-10">Carrito vacío</p>}
          {cart.map((item) => (
            <div key={item.productId} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{item.productName}</p>
                <p className="text-xs text-gray-500">${item.price} c/u</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => removeFromCart(item.productId)} className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-xs font-bold">−</button>
                <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                <button onClick={() => addToCart({ id: item.productId, name: item.productName, price: item.price })} className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-xs font-bold">+</button>
              </div>
              <span className="text-sm font-semibold text-gray-700 w-16 text-right">${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-200">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">Subtotal</span>
            <span className="font-medium">${subtotal.toFixed(2)}</span>
          </div>
          {successMsg && <p className="text-green-600 text-sm font-medium mb-2 text-center">{successMsg}</p>}
          <button
            onClick={() => placeOrder.mutate()}
            disabled={cart.length === 0 || placeOrder.isPending}
            className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold rounded-xl text-base transition-colors"
          >
            {placeOrder.isPending ? 'Enviando…' : `Enviar a cocina — $${subtotal.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
