import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth.store';
import { BillingModal } from '../components/BillingModal';

interface CartItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
}

interface PendingOrderItem {
  id: string;
  productName: string;
  quantity: number;
  subtotal: number;
}

interface PendingOrder {
  id: string;
  orderNumber: number;
  type: 'dine_in' | 'takeout' | 'delivery' | 'kiosk';
  userId?: string | null;
  status: 'pending' | 'in_preparation' | 'ready' | 'delivered' | 'completed' | 'cancelled';
  subtotal: number;
  taxAmount: number;
  tipAmount: number;
  discountAmount: number;
  total: number;
  createdAt: string;
  table?: { number: number };
  items: PendingOrderItem[];
}

type UiOrderType = 'DINE_IN' | 'TO_GO' | 'DELIVERY';
type MobileSection = 'orders' | 'billing';

const ORDER_TYPE_TO_API: Record<UiOrderType, 'dine_in' | 'takeout' | 'delivery'> = {
  DINE_IN: 'dine_in',
  TO_GO: 'takeout',
  DELIVERY: 'delivery',
};

interface PosTable {
  id: string;
  number: number;
  status: string;
}

export default function PosPage() {
  const { user, logout } = useAuthStore();
  const branchId = user?.branchId ?? '';
  const qc = useQueryClient();

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<UiOrderType>('DINE_IN');
  const [tableId, setTableId] = useState('');
  const [kitchenNote, setKitchenNote] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showBilling, setShowBilling] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PendingOrder | null>(null);
  const [mobileSection, setMobileSection] = useState<MobileSection>('orders');

  const { data: categories = [] } = useQuery({
    queryKey: ['pos-categories', branchId],
    queryFn: () => api.get(`/menu/categories?branchId=${branchId}`).then((r) => r.data),
    enabled: !!branchId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['pos-products', branchId, activeCategory],
    queryFn: () =>
      api
        .get(`/menu/products?branchId=${branchId}${activeCategory ? `&categoryId=${activeCategory}` : ''}`)
        .then((r) => r.data),
    enabled: !!branchId,
  });

  const { data: tables = [] } = useQuery<PosTable[]>({
    queryKey: ['pos-tables', branchId],
    queryFn: () => api.get(`/tables?branchId=${branchId}`).then((r) => r.data),
    enabled: !!branchId && orderType === 'DINE_IN',
  });

  const { data: kioskMenuConfig } = useQuery<{ branchConfig?: { taxPercentage?: number } } | null>({
    queryKey: ['pos-tax-config', branchId],
    queryFn: () =>
      api
        .get(`/kiosk/${branchId}/menu`)
        .then((r) => r.data)
        .catch(() => null),
    enabled: !!branchId,
    staleTime: 5 * 60_000,
  });

  const { data: pendingOrders = [], isLoading: pendingOrdersLoading } = useQuery<PendingOrder[]>({
    queryKey: ['pos-pending-billing', branchId],
    queryFn: () =>
      api
        .get(`/orders?branchId=${branchId}`)
        .then((r) => r.data)
        .then((orders: PendingOrder[]) =>
          orders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled'),
        ),
    enabled: !!branchId,
    refetchInterval: 15000,
  });

  const freeTables = tables.filter((t) => String(t.status).toLowerCase() === 'free');

  const addToCart = (product: { id: string; name: string; price: number }) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [
        ...prev,
        { productId: product.id, productName: product.name, price: product.price, quantity: 1 },
      ];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => {
      const item = prev.find((i) => i.productId === productId);
      if (!item) return prev;
      if (item.quantity <= 1) return prev.filter((i) => i.productId !== productId);
      return prev.map((i) =>
        i.productId === productId ? { ...i, quantity: i.quantity - 1 } : i,
      );
    });
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const taxPercentage = Number(kioskMenuConfig?.branchConfig?.taxPercentage ?? 0);
  const taxAmount = subtotal * (taxPercentage / 100);
  const totalWithTax = subtotal + taxAmount;
  const missingRequiredTable = orderType === 'DINE_IN' && !tableId;

  const placeOrder = useMutation({
    mutationFn: () =>
      api
        .post('/orders', {
          branchId,
          type: ORDER_TYPE_TO_API[orderType],
          tableId: orderType === 'DINE_IN' && tableId ? tableId : undefined,
          notes: kitchenNote.trim() ? kitchenNote.trim() : undefined,
          taxPercentage,
          tipPercentage: 0,
          discountAmount: 0,
          items: cart.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            unitPrice: item.price,
            quantity: item.quantity,
            notes: kitchenNote.trim() ? kitchenNote.trim() : undefined,
            modifiers: [],
          })),
        })
        .then((r) => r.data),
    onSuccess: () => {
      setCart([]);
      setTableId('');
      setKitchenNote('');
      setSuccessMsg('Orden enviada a cocina. Lista para facturacion cuando corresponda.');
      setTimeout(() => setSuccessMsg(''), 3000);
      qc.invalidateQueries({ queryKey: ['pos-tables'] });
      qc.invalidateQueries({ queryKey: ['pos-pending-billing'] });
    },
  });

  const openBillingForOrder = (order: PendingOrder) => {
    setSelectedOrder(order);
    setShowBilling(true);
  };

  return (
    <>
      <BillingModal
        isOpen={showBilling}
        order={selectedOrder}
        onClose={() => {
          setShowBilling(false);
          setSelectedOrder(null);
          qc.invalidateQueries({ queryKey: ['pos-pending-billing'] });
          qc.invalidateQueries({ queryKey: ['pos-tables'] });
        }}
      />

      <div className="flex h-screen overflow-hidden flex-col xl:flex-row">
        <div className="xl:hidden bg-white border-b border-gray-200 p-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMobileSection('orders')}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                mobileSection === 'orders' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              Ordenes nuevas
            </button>
            <button
              onClick={() => setMobileSection('billing')}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                mobileSection === 'billing' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              Facturacion ({pendingOrders.length})
            </button>
          </div>
        </div>

        <div
          className={`${mobileSection === 'orders' ? 'flex' : 'hidden'} xl:flex flex-1 min-w-0 min-h-0 flex-col overflow-hidden xl:border-r border-gray-200`}
        >
          <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
            <span className="font-bold text-lg">POS</span>
            <div className="flex gap-2">
              {['DINE_IN', 'TO_GO', 'DELIVERY'].map((t) => (
                <button
                  key={t}
                  onClick={() => setOrderType(t as UiOrderType)}
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    orderType === t ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {t === 'DINE_IN' ? 'Mesa' : t === 'TO_GO' ? 'Para llevar' : 'Delivery'}
                </button>
              ))}
            </div>
            <button onClick={() => logout()} className="text-xs text-red-500">Salir</button>
          </div>

          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700">Seccion de ordenes</h2>
            <p className="text-xs text-gray-500">
              Crea y envia ordenes a cocina. La facturacion se procesa en el panel derecho.
            </p>
          </div>

          <div className="flex-1 min-h-0 flex flex-col xl:flex-row">
            <div className="flex-[3] min-h-0 min-w-0 flex flex-col overflow-hidden">
              <div className="bg-white border-b border-gray-200 px-4 py-2 flex gap-2 overflow-x-auto">
                <button
                  onClick={() => setActiveCategory(null)}
                  className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium ${
                    !activeCategory ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  Todos
                </button>
                {categories.map((c: { id: string; name: string }) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveCategory(c.id)}
                    className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium ${
                      activeCategory === c.id ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 content-start">
                {products
                  .filter((p: { isActive: boolean }) => p.isActive)
                  .map((p: { id: string; name: string; price: number; imageUrl?: string }) => (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p)}
                      className="bg-white rounded-xl border border-gray-200 p-3 text-left hover:shadow-md hover:border-brand-400 active:scale-95 transition-all"
                    >
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="w-full h-20 object-cover rounded-lg mb-2" />
                      ) : (
                        <div className="w-full h-20 bg-gray-100 rounded-lg mb-2 flex items-center justify-center text-xs text-gray-400">
                          Sin imagen
                        </div>
                      )}
                      <p className="text-xs font-medium text-gray-800 line-clamp-2">{p.name}</p>
                      <p className="text-sm font-bold text-brand-600 mt-0.5">${p.price}</p>
                    </button>
                  ))}
              </div>
            </div>

            <div className="flex-[2] min-h-0 xl:flex-none w-full xl:w-80 bg-white border-t xl:border-t-0 xl:border-l border-gray-200 flex flex-col">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-bold text-gray-800">Orden actual</h3>
                {orderType === 'DINE_IN' && (
                  <>
                    <select
                      value={tableId}
                      onChange={(e) => setTableId(e.target.value)}
                      className="mt-2 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="">Seleccionar mesa...</option>
                      {freeTables.map((t) => (
                        <option key={t.id} value={t.id}>Mesa {t.number}</option>
                      ))}
                    </select>
                    {freeTables.length === 0 && (
                      <p className="text-xs text-amber-600 mt-2">No hay mesas libres en este momento.</p>
                    )}
                  </>
                )}

                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-gray-600">Nota para cocina</label>
                    <span className="text-[11px] text-gray-400">{kitchenNote.length}/250</span>
                  </div>
                  <textarea
                    value={kitchenNote}
                    onChange={(e) => setKitchenNote(e.target.value)}
                    rows={1}
                    maxLength={250}
                    placeholder="Ej: sin azucar, alergia..."
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {cart.length === 0 && (
                  <p className="text-gray-400 text-sm text-center mt-10">Carrito vacio</p>
                )}
                {cart.map((item) => (
                  <div key={item.productId} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{item.productName}</p>
                      <p className="text-xs text-gray-500">${item.price} c/u</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => removeFromCart(item.productId)}
                        className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-xs font-bold"
                      >
                        -
                      </button>
                      <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                      <button
                        onClick={() =>
                          addToCart({ id: item.productId, name: item.productName, price: item.price })
                        }
                        className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-xs font-bold"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-sm font-semibold text-gray-700 w-16 text-right">
                      ${(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-gray-200">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-medium">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Impuesto ({taxPercentage.toFixed(2)}%)</span>
                  <span>${taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm mb-2 font-semibold">
                  <span className="text-gray-700">Total</span>
                  <span>${totalWithTax.toFixed(2)}</span>
                </div>
                {successMsg && (
                  <p className="text-green-600 text-sm font-medium mb-2 text-center">{successMsg}</p>
                )}
                {missingRequiredTable && (
                  <p className="text-amber-600 text-xs font-medium mb-2 text-center">
                    Debes seleccionar una mesa para enviar una orden tipo Mesa.
                  </p>
                )}
                <button
                  onClick={() => placeOrder.mutate()}
                  disabled={cart.length === 0 || placeOrder.isPending || missingRequiredTable}
                  className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold rounded-xl text-base transition-colors"
                >
                  {placeOrder.isPending ? 'Enviando...' : `Enviar a cocina - $${totalWithTax.toFixed(2)}`}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div
          className={`${mobileSection === 'billing' ? 'flex' : 'hidden'} xl:flex w-full xl:w-[420px] flex-1 min-h-0 bg-gray-50 flex-col`}
        >
          <div className="px-4 py-3 border-b border-gray-200 bg-white">
            <h2 className="font-bold text-gray-800">Facturacion</h2>
            <p className="text-xs text-gray-500">
              Ordenes enviadas sin facturar (incluye kiosko no pagado).
            </p>
          </div>

          <div className="px-4 py-2 border-b border-gray-200 bg-white text-sm text-gray-600">
            Pendientes: <span className="font-semibold text-gray-800">{pendingOrders.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {pendingOrdersLoading && (
              <p className="text-sm text-gray-500">Cargando ordenes pendientes...</p>
            )}

            {!pendingOrdersLoading && pendingOrders.length === 0 && (
              <div className="text-sm text-gray-500 bg-white border border-dashed border-gray-300 rounded-xl p-4 text-center">
                No hay ordenes pendientes de facturacion.
              </div>
            )}

            {pendingOrders.map((order) => {
              const isKioskOrigin = order.type === 'kiosk' || (!order.table?.number && !order.userId);
              const sourceLabel =
                isKioskOrigin
                  ? 'Kiosko'
                  : order.type === 'takeout'
                    ? 'Para llevar'
                    : order.type === 'delivery'
                      ? 'Delivery'
                  : order.table?.number
                    ? `Mesa ${order.table.number}`
                    : 'Sin mesa';

              return (
                <div key={order.id} className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-800">Orden #{order.orderNumber}</p>
                      <p className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleString()}</p>
                    </div>
                    <span
                      className={`text-[11px] px-2 py-1 rounded-full font-semibold ${
                        isKioskOrigin ? 'bg-cyan-100 text-cyan-700' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {sourceLabel}
                    </span>
                  </div>

                  <div className="text-xs text-gray-600 space-y-1 max-h-20 overflow-y-auto">
                    {order.items.slice(0, 4).map((item) => (
                      <p key={item.id}>{item.quantity}x {item.productName}</p>
                    ))}
                    {order.items.length > 4 && (
                      <p className="text-gray-400">+{order.items.length - 4} item(s) mas...</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                    <span className="text-sm text-gray-500">Total</span>
                    <span className="font-bold text-brand-600">${Number(order.total || 0).toFixed(2)}</span>
                  </div>

                  <button
                    onClick={() => openBillingForOrder(order)}
                    className="w-full py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold"
                  >
                    Facturar orden
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
