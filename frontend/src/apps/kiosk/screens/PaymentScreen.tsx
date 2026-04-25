import { useKioskStore } from '../store/kiosk.store';
import type { Strings } from '../i18n/strings';

export default function PaymentScreen({
  t,
  onPayment,
  isPending,
}: {
  t: Strings;
  onPayment: (method: 'CARD' | 'CASH') => void;
  isPending: boolean;
}) {
  const { goTo, cart } = useKioskStore();
  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <div className="w-full h-full flex flex-col bg-gray-900">
      <div className="flex items-center gap-4 px-6 py-4 bg-gray-800 border-b border-gray-700">
        <button onClick={() => goTo('CART')} className="text-gray-400 hover:text-white text-2xl">←</button>
        <h2 className="text-2xl font-bold text-white">Método de pago</h2>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-10">
        <p className="text-5xl font-black text-brand-400">${total.toFixed(2)}</p>

        <div className="flex gap-10">
          <button
            onClick={() => onPayment('CARD')}
            disabled={isPending}
            className="flex flex-col items-center gap-4 bg-gray-800 hover:bg-brand-700 active:scale-95 disabled:opacity-50 border-2 border-gray-700 hover:border-brand-500 rounded-3xl p-12 w-60 transition-all"
          >
            <span className="text-6xl">💳</span>
            <span className="text-2xl font-bold text-white">{t.payWithCard}</span>
          </button>
          <button
            onClick={() => onPayment('CASH')}
            disabled={isPending}
            className="flex flex-col items-center gap-4 bg-gray-800 hover:bg-brand-700 active:scale-95 disabled:opacity-50 border-2 border-gray-700 hover:border-brand-500 rounded-3xl p-12 w-60 transition-all"
          >
            <span className="text-6xl">💵</span>
            <span className="text-2xl font-bold text-white">{t.payWithCash}</span>
          </button>
        </div>

        {isPending && <p className="text-gray-400 text-lg animate-pulse">Procesando…</p>}
      </div>
    </div>
  );
}
