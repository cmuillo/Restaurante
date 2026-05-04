import { useKioskStore } from '../store/kiosk.store';
import type { Strings } from '../i18n/strings';

export default function CartScreen({
  t,
  isPending,
}: {
  t: Strings;
  isPending: boolean;
}) {
  const { cart, removeFromCart, goTo } = useKioskStore();
  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <div className="w-full h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 bg-gray-800 border-b border-gray-700">
        <button onClick={() => goTo('MENU')} className="text-gray-400 hover:text-white text-2xl">←</button>
        <h2 className="text-2xl font-bold text-white">{t.myOrder}</h2>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {cart.length === 0 && (
          <p className="text-center text-gray-500 text-xl mt-20">{t.empty}</p>
        )}
        {cart.map((item) => (
          <div key={item.productId} className="bg-gray-800 rounded-2xl p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-lg font-semibold text-white">{item.productName}</p>
              {item.modifiers.length > 0 && (
                <div className="text-sm text-gray-400 mt-0.5">
                  {item.modifiers.map((m, i) => <span key={i}>+ {m.optionName} </span>)}
                </div>
              )}
              {item.notes && <p className="text-sm text-yellow-400 mt-0.5">📝 {item.notes}</p>}
            </div>
            <div className="text-right">
              <p className="text-base text-gray-400">{item.quantity}× ${item.price}</p>
              <p className="text-xl font-bold text-brand-400">${(item.price * item.quantity).toFixed(2)}</p>
            </div>
            <button
              onClick={() => removeFromCart(item.productId)}
              className="text-gray-600 hover:text-red-400 transition-colors text-2xl ml-2"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Footer */}
      {cart.length > 0 && (
        <div className="px-6 py-5 bg-gray-800 border-t border-gray-700 space-y-4">
          <div className="flex justify-between text-2xl font-bold text-white">
            <span>{t.total}</span>
            <span className="text-brand-400">${total.toFixed(2)}</span>
          </div>
          <button
            onClick={() => goTo('PAYMENT')}
            disabled={isPending}
            className="w-full py-5 bg-brand-600 hover:bg-brand-500 active:scale-95 disabled:opacity-50 rounded-2xl font-bold text-xl text-white transition-all"
          >
            {t.placeOrder}
          </button>
        </div>
      )}
    </div>
  );
}
