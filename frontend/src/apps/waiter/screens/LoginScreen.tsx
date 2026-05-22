import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import waiterApi from '../lib/waiter-api';
import { useWaiterStore } from '../store/waiter.store';
import { useSettings } from '../../../hooks/useSettings';

export default function LoginScreen() {
  const { login } = useWaiterStore();
  const settings = useSettings();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      waiterApi.post('/auth/login', { email, password }).then((r) => r.data),
    onSuccess: (data: { accessToken: string; user: { id: string; name: string; email: string; role: string; branchId: string } }) => {
      const { accessToken: token, user } = data;
      const allowedRoles = ['waiter', 'cashier', 'branch_admin', 'super_admin'];
      if (!allowedRoles.includes(user.role)) {
        setError('Tu cuenta no tiene permisos para usar esta app.');
        return;
      }
      login(token, {
        id: user.id,
        name: user.name ?? user.email,
        email: user.email,
        role: user.role,
        branchId: user.branchId,
      });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Credenciales incorrectas.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Ingresa tu correo y contraseña.');
      return;
    }
    mutate();
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 px-6 gap-8">
      <div className="flex flex-col items-center gap-3">
        {settings.logoBase64 ? (
          <img
            src={settings.logoBase64}
            alt={settings.restaurantName}
            className="h-16 object-contain"
          />
        ) : (
          <span className="text-5xl">🍽️</span>
        )}
        <h1 className="text-2xl font-black text-gray-900">
          {settings.restaurantName || 'Restaurante'}
        </h1>
        <p className="text-gray-500 text-base">App del mesero</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Correo electrónico
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="mesero@restaurante.com"
            autoComplete="email"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          />
        </div>

        {error && (
          <p className="text-red-600 text-sm bg-red-50 rounded-xl px-4 py-3">{error}</p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-brand-600 hover:bg-brand-500 active:scale-95 disabled:opacity-50 text-white font-bold text-lg rounded-xl py-4 transition-all"
        >
          {isPending ? 'Iniciando sesión…' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
