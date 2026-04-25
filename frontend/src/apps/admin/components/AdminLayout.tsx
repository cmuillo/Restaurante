import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../stores/auth.store';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/menu', label: 'Menú', icon: '🍽️' },
  { to: '/tables', label: 'Mesas', icon: '🪑' },
  { to: '/orders', label: 'Órdenes', icon: '📋' },
  { to: '/inventory', label: 'Inventario', icon: '📦' },
  { to: '/customers', label: 'Clientes', icon: '👥' },
  { to: '/reports', label: 'Reportes', icon: '📈' },
  { to: '/users', label: 'Usuarios', icon: '👤' },
  { to: '/branches', label: 'Sucursales', icon: '🏢' },
];

export default function AdminLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-brand-600">🍴 Restaurante</h1>
          <p className="text-xs text-gray-500 mt-1">Panel de Administración</p>
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
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
