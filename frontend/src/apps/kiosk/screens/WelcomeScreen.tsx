import { useEffect, useState } from 'react';
import { useKioskStore } from '../store/kiosk.store';
import { useSettings } from '../../../hooks/useSettings';
import type { Strings } from '../i18n/strings';

export default function WelcomeScreen({ t }: { t: Strings }) {
  const goTo = useKioskStore((s) => s.goTo);
  const settings = useSettings();
  const images: string[] = settings.kioskCarouselImages ?? [];
  const interval = Math.max(1, settings.kioskCarouselInterval ?? 5) * 1000;
  const [activeIdx, setActiveIdx] = useState(0);

  // Avance automático del carrusel
  useEffect(() => {
    if (images.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % images.length);
    }, interval);
    return () => clearInterval(timer);
  }, [images.length, interval]);

  // Resetear índice si cambian las imágenes
  useEffect(() => {
    setActiveIdx(0);
  }, [images.length]);

  return (
    <div
      className="w-full h-full flex flex-col items-center cursor-pointer select-none"
      style={{
        background: `linear-gradient(160deg, ${settings.kioskWelcomeColor}, ${settings.kioskWelcomeColorDark})`,
      }}
      onClick={() => goTo('CUSTOMER')}
    >
      {/* ── Logo ────────────────────────────────────────────────────── */}
      <div className="flex justify-center pt-10 pb-4">
        {settings.logoBase64
          ? <img src={settings.logoBase64} alt={settings.restaurantName} className="h-20 object-contain drop-shadow-lg" />
          : <span className="text-7xl">🍴</span>
        }
      </div>

      {/* ── Carrusel ────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center w-full px-6 min-h-0 py-2">
        {images.length > 0 ? (
          <div
            className="relative rounded-3xl overflow-hidden shadow-2xl bg-black/20"
            style={{ aspectRatio: '2/3', height: '100%', maxHeight: '100%', maxWidth: '100%' }}
          >
            {images.map((src, idx) => (
              <img
                key={idx}
                src={src}
                alt={`Promo ${idx + 1}`}
                className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-700 ${idx === activeIdx ? 'opacity-100' : 'opacity-0'}`}
              />
            ))}
            {/* Indicadores */}
            {images.length > 1 && (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                {images.map((_, idx) => (
                  <span
                    key={idx}
                    className={`rounded-full transition-all duration-300 ${idx === activeIdx ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-white/50'}`}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Sin imágenes: solo el emoji grande */
          <span className="text-[10rem] opacity-30 select-none">🍽️</span>
        )}
      </div>

      {/* ── Mensaje de bienvenida ───────────────────────────────────── */}
      <div className="text-center px-8 pb-12 pt-6">
        <h1 className="text-5xl font-black text-white drop-shadow">
          {settings.kioskWelcomeMessage || t.welcome}
        </h1>
        <p className="text-xl text-white/80 mt-3 animate-pulse">
          {settings.kioskWelcomeSubtitle || t.tapToStart}
        </p>
      </div>
    </div>
  );
}
