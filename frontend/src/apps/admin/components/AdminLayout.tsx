import { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../../stores/auth.store';
import { useBranchStore } from '../../../stores/branch.store';
import { useSettings } from '../../../hooks/useSettings';
import api from '../../../lib/api';

type Branch = { id: string; name: string };

const navItems = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/menu', label: 'Menú', icon: '🍽️' },
  { to: '/tables', label: 'Mesas', icon: '🪑' },
  { to: '/orders', label: 'Órdenes', icon: '📋' },
  { to: '/invoices', label: 'Facturas', icon: '🧾' },
  { to: '/quotations', label: 'Cotizaciones', icon: '📝' },
  { to: '/expenses', label: 'Gastos', icon: '💸' },
  { to: '/customers', label: 'Clientes', icon: '👥' },
  { to: '/reports', label: 'Reportes', icon: '📈' },
  { to: '/users', label: 'Usuarios', icon: '👤' },
  { to: '/branches', label: 'Sucursales', icon: '🏢' },
  { to: '/hacienda', label: 'Hacienda', icon: '🧾' },
  { to: '/settings', label: 'Personalización', icon: '⚙️' },
];

export default function AdminLayout() {
  const { user, logout } = useAuthStore();
  const { activeBranchId, setActiveBranchId } = useBranchStore();
  const settings = useSettings();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isSuperAdmin = user?.role === 'super_admin';
  const isAdminRole = user?.role === 'super_admin' || user?.role === 'branch_admin';

  const selectedBranchQs = isSuperAdmin && activeBranchId ? `?branchId=${activeBranchId}` : '';
  const moduleLinks = [
    { href: `/pos/${selectedBranchQs}`, label: 'POS' },
    { href: `/kitchen/${selectedBranchQs}`, label: 'Kitchen' },
    { href: `/kiosk/${selectedBranchQs}`, label: 'Kiosko' },
  ];

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: () => api.get('/branches').then((r) => r.data),
    enabled: isSuperAdmin,
  });

  // Auto-select a valid branch when list loads.
  useEffect(() => {
    const hasValidActiveBranch = branches.some((b) => b.id === activeBranchId);
    if (isSuperAdmin && branches.length > 0 && !hasValidActiveBranch) {
      setActiveBranchId(branches[0].id);
    }
  }, [isSuperAdmin, branches, activeBranchId, setActiveBranchId]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className={`flex h-screen bg-gray-50 ${settings.theme === 'dark' ? 'dark' : ''}`}>
      {/* Sidebar */}
      <aside
        className={`bg-white border-r border-gray-200 flex flex-col transition-all duration-200 overflow-hidden ${sidebarOpen ? 'w-64' : 'w-0 border-r-0'}`}
      >
        <div className="p-4 border-b border-gray-200">
          {settings.logoBase64
            ? <img src={settings.logoBase64} alt={settings.restaurantName} className="h-10 object-contain mb-1" />
            : <h1 className="text-xl font-bold text-brand-600">🍴 {settings.restaurantName}</h1>
          }
          {settings.restaurantSlogan && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{settings.restaurantSlogan}</p>
          )}

          {/* Branch selector for SUPER_ADMIN */}
          {isSuperAdmin && (
            <div className="mt-3">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Sucursal</label>
              <select
                value={activeBranchId}
                onChange={(e) => setActiveBranchId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">— Seleccionar —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <span>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <p className="text-sm font-medium text-gray-700 truncate">{user?.name}</p>
          <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          <button
            onClick={handleLogout}
            className="mt-2 text-xs text-red-500 hover:text-red-700 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-4 lg:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50"
            >
              <span>{sidebarOpen ? '◀' : '▶'}</span>
              {sidebarOpen ? 'Ocultar menú' : 'Mostrar menú'}
            </button>

            {isAdminRole && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Módulos</span>
                {moduleLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            )}
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
