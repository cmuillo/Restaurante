import { useState } from 'react';
import { useWaiterStore } from '../store/waiter.store';
import { useSettings } from '../../../hooks/useSettings';
import { formatCurrency } from '../../../stores/settings.store';

interface Props {
  isPending: boolean;
}

export default function CartScreen({ isPending }: Props) {
  const { cart, updateCartQty, removeFromCart, goTo, selectedTable } =
    useWaiterStore();
  const settings = useSettings();
  const [orderNotes, setOrderNotes] = useState('');

  const subtotal = cart.reduce((a, i) => a + i.price * i.quantity, 0);
  const taxAmount = cart.reduce((a, i) => a + i.price * (i.taxRate / 100) * i.quantity, 0);
  const total = subtotal + taxAmount;

  const contextLabel = selectedTable?.id ? `Mesa ${selectedTable.number}` : 'Para llevar';

  const handleSend = () => {
    window.dispatchEvent(new CustomEvent('waiter:submit-order', { detail: { notes: orderNotes } }));
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <button
          onClick={() => goTo('MENU')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-700 text-sm font-semibold transition-all"
        >
          ‹ Menú
        </button>
        <h2 className="font-bold text-gray-900">Orden · {contextLabel}</h2>
        <div className="w-16" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 pb-48">
        {cart.length === 0 ? (
          <p className="text-center text-gray-400 mt-16">El carrito está vacío</p>
        ) : (
          cart.map((item, idx) => (
            <div key={`${item.productId}-${idx}`} className="flex gap-3 bg-white rounded-2xl p-3 shadow-sm">
              <div className="flex-1">
                <p className="font-semibold text-gray-900 text-sm leading-tight">{item.productName}</p>
                {item.modifiers.length > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {item.modifiers.map((m) => m.optionName).join(', ')}
                  </p>
                )}
                {item.notes && (
                  <p className="text-xs text-gray-400 italic mt-0.5">"{item.notes}"</p>
                )}
                <p className="text-sm font-bold text-brand-600 mt-1">
                  {formatCurrency(item.price * (1 + item.taxRate / 100), settings)}
                </p>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-1 bg-gray-100 rounded-xl px-1 py-1">
                  <button
                    onClick={() => updateCartQty(item.productId, item.quantity - 1)}
                    className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-base font-bold shadow-sm active:scale-90 transition-all"
                  >
                    −
                  </button>
                  <span className="w-5 text-center text-sm font-black">{item.quantity}</span>
                  <button
                    onClick={() => updateCartQty(item.productId, item.quantity + 1)}
                    className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-base font-bold shadow-sm active:scale-90 transition-all"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={() => removeFromCart(item.productId)}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))
        )}

        {/* Notas de orden */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Notas generales de la orden
          </label>
          <textarea
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
            placeholder="Instrucciones especiales para cocina…"
            rows={2}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none bg-white"
          />
        </div>
      </div>

      {/* Barra inferior */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 flex flex-col gap-2 shadow-lg">
        <div className="flex justify-between text-base font-bold text-gray-900 px-1">
          <span>Total</span>
          <span>{formatCurrency(total, settings)}</span>
        </div>
        <button
          onClick={handleSend}
          disabled={isPending || cart.length === 0}
          className="w-full bg-brand-600 hover:bg-brand-500 active:scale-95 disabled:opacity-50 text-white font-bold rounded-2xl py-4 text-base transition-all"
        >
          {isPending ? 'Enviando a cocina…' : '🧑‍🍳 Enviar a cocina'}
        </button>
      </div>
    </div>
  );
}
