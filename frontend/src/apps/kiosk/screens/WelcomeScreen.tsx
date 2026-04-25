import { useKioskStore } from '../store/kiosk.store';
import type { Strings } from '../i18n/strings';

export default function WelcomeScreen({ t }: { t: Strings }) {
  const goTo = useKioskStore((s) => s.goTo);
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-brand-600 to-brand-800 cursor-pointer"
      onClick={() => goTo('LANGUAGE')}
    >
      <span className="text-9xl mb-8">🍴</span>
      <h1 className="text-6xl font-black text-white mb-4">{t.welcome}</h1>
      <p className="text-2xl text-brand-200 animate-pulse">{t.tapToStart}</p>
    </div>
  );
}
