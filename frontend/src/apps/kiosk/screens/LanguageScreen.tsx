import { useKioskStore } from '../store/kiosk.store';
import { i18n } from '../i18n/strings';

const LANGUAGES = [
  { code: 'es' as const, label: '🇲🇽 Español', native: 'Español' },
  { code: 'en' as const, label: '🇺🇸 English', native: 'English' },
];

export default function LanguageScreen() {
  const { setLanguage } = useKioskStore();
  const t = i18n.es;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 gap-10">
      <h2 className="text-4xl font-bold text-white">{t.selectLanguage}</h2>
      <div className="flex gap-8">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className="flex flex-col items-center gap-4 bg-gray-800 hover:bg-brand-700 active:scale-95 border-2 border-gray-700 hover:border-brand-500 rounded-3xl p-10 transition-all w-52"
          >
            <span className="text-6xl">{lang.label.split(' ')[0]}</span>
            <span className="text-2xl font-bold text-white">{lang.native}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
