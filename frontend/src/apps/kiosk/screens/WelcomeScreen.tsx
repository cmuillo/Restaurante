import { useKioskStore } from '../store/kiosk.store';
import { useSettings } from '../../../hooks/useSettings';
import type { Strings } from '../i18n/strings';

export default function WelcomeScreen({ t }: { t: Strings }) {
  const goTo = useKioskStore((s) => s.goTo);
  const settings = useSettings();

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center cursor-pointer"
      style={{
        background: `linear-gradient(135deg, ${settings.kioskWelcomeColor}, ${settings.kioskWelcomeColorDark})`,
      }}
      onClick={() => goTo('CUSTOMER')}
    >
      {settings.logoBase64
        ? <img src={settings.logoBase64} alt={settings.restaurantName} className="h-24 object-contain mb-8 drop-shadow-lg" />
        : <span className="text-9xl mb-8">🍴</span>
      }
      <h1 className="text-6xl font-black text-white mb-4">{settings.kioskWelcomeMessage || t.welcome}</h1>
      <p className="text-2xl text-white/80 animate-pulse">{settings.kioskWelcomeSubtitle || t.tapToStart}</p>
    </div>
  );
}
