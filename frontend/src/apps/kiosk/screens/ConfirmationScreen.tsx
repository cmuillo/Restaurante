import { useEffect, useState } from 'react';
import { useKioskStore } from '../store/kiosk.store';
import type { Strings } from '../i18n/strings';

const AUTO_RESET_SECS = 15;

export default function ConfirmationScreen({ t, onReset }: { t: Strings; onReset: () => void }) {
  const confirmedOrderNumber = useKioskStore((s) => s.confirmedOrderNumber);
  const confirmedOrderMessage = useKioskStore((s) => s.confirmedOrderMessage);
  const confirmedTableNumber = useKioskStore((s) => s.confirmedTableNumber);
  const [secs, setSecs] = useState(AUTO_RESET_SECS);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecs((s) => {
        if (s <= 1) { onReset(); return AUTO_RESET_SECS; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onReset]);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-green-900 to-gray-900 gap-8">
      <span className="text-9xl">✅</span>
      <h1 className="text-5xl font-black text-white text-center">{t.orderPlaced}</h1>
      <div className="bg-gray-800 rounded-3xl px-12 py-6 text-center">
        <p className="text-gray-400 text-xl mb-2">{t.yourOrderNumber}</p>
        <p className="text-8xl font-black text-brand-400">{confirmedOrderNumber}</p>
      </div>
      <div className="bg-gray-800 rounded-3xl px-8 py-5 text-center max-w-2xl">
        <p className="text-gray-400 text-lg mb-2">
          {confirmedTableNumber ? t.tableAssigned : t.orderInfo}
        </p>
        <p className="text-2xl font-bold text-white">
          {confirmedTableNumber ? `Mesa ${confirmedTableNumber}` : confirmedOrderMessage || 'Tu pedido fue registrado correctamente.'}
        </p>
      </div>
      <p className="text-gray-400 text-xl">{t.waitForNumber}</p>
      <button
        onClick={onReset}
        className="mt-4 px-10 py-4 bg-gray-700 hover:bg-gray-600 active:scale-95 rounded-2xl text-lg font-semibold text-white transition-all"
      >
        {t.newOrder} ({secs}s)
      </button>
    </div>
  );
}
