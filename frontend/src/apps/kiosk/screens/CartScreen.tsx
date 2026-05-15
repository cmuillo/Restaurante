import { useKioskStore } from '../store/kiosk.store';
import type { Strings } from '../i18n/strings';
import { useSettings } from '../../../hooks/useSettings';
import { formatCurrency } from '../../../stores/settings.store';

export default function CartScreen({
  t,
  isPending,
}: {
  t: Strings;
  isPending: boolean;
}) {
  const { cart, removeFromCart, goTo, customer } = useKioskStore();
  const settings = useSettings();
  const isExempt = customer?.isExempt ?? false;
  const total = cart.reduce((s, i) => s + i.price * (1 + i.taxRate / 100) * i.quantity, 0);

  return (
    <div className="w-full h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <button onClick={() => goTo('MENU')} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-2xl">←</button>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t.myOrder}</h2>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {cart.length === 0 && (
          <p className="text-center text-gray-400 dark:text-gray-500 text-xl mt-20">{t.empty}</p>
        )}
        {cart.map((item) => (
          <div key={item.productId} className="bg-white dark:bg-gray-800 rounded-2xl p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{item.productName}</p>
              {item.modifiers.length > 0 && (
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {item.modifiers.map((m, i) => <span key={i}>+ {m.optionName} </span>)}
                </div>
              )}
              {item.notes && <p className="text-sm text-yellow-400 mt-0.5">📝 {item.notes}</p>}
            </div>
            <div className="text-right">
              <p className="text-base text-gray-500 dark:text-gray-400">{item.quantity}× {formatCurrency(item.price * (1 + item.taxRate / 100), settings)}</p>
              <p className="text-xl font-bold text-brand-400">{formatCurrency(item.price * (1 + item.taxRate / 100) * item.quantity, settings)}</p>
            </div>
            <button
              onClick={() => removeFromCart(item.productId)}
              className="text-gray-400 dark:text-gray-600 hover:text-red-400 transition-colors text-2xl ml-2"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Footer */}
      {cart.length > 0 && (
        <div className="px-6 py-5 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 space-y-4">
          <div className="flex justify-between text-2xl font-bold text-gray-900 dark:text-white">
            <span>{t.total}</span>
            <span className="text-brand-400">{formatCurrency(total, settings)}</span>
          </div>
          {isExempt && (
            <p className="text-xs text-amber-400 text-center">IVA exonerado — se reflejará en la factura</p>
          )}
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
