import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { useSettingsStore, type GlobalSettings } from '../stores/settings.store';

/**
 * Carga las settings globales desde la API y las sincroniza al store.
 * Úsalo una vez en el componente raíz de cada app.
 */
export function useSettingsLoader() {
  const setSettings = useSettingsStore((s) => s.setSettings);

  const { data } = useQuery<GlobalSettings>({
    queryKey: ['global-settings'],
    queryFn: () => api.get('/settings').then((r) => r.data),
    staleTime: 5 * 60_000,
    retry: 2,
  });

  useEffect(() => {
    if (data) setSettings(data);
  }, [data, setSettings]);
}

/** Acceso directo a las settings globales desde el store (sin fetch). */
export function useSettings(): GlobalSettings {
  return useSettingsStore((s) => s.settings);
}
