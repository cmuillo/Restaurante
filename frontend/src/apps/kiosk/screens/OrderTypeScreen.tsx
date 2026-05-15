import { useKioskStore } from '../store/kiosk.store';
import type { Strings } from '../i18n/strings';

export default function OrderTypeScreen({ t }: { t: Strings }) {
  const { setOrderType } = useKioskStore();

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 gap-10">
      <h2 className="text-4xl font-bold text-gray-900 dark:text-white">{t.howDoYouWant}</h2>
      <div className="flex gap-10">
        <button
          onClick={() => setOrderType('DINE_IN')}
          className="flex flex-col items-center gap-4 bg-white dark:bg-gray-800 hover:bg-brand-700 active:scale-95 border-2 border-gray-200 dark:border-gray-700 hover:border-brand-500 rounded-3xl p-12 transition-all w-60"
        >
          <span className="text-6xl">🪑</span>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">{t.dineIn}</span>
        </button>
        <button
          onClick={() => setOrderType('TO_GO')}
          className="flex flex-col items-center gap-4 bg-white dark:bg-gray-800 hover:bg-brand-700 active:scale-95 border-2 border-gray-200 dark:border-gray-700 hover:border-brand-500 rounded-3xl p-12 transition-all w-60"
        >
          <span className="text-6xl">🛍️</span>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">{t.toGo}</span>
        </button>
      </div>
    </div>
  );
}
