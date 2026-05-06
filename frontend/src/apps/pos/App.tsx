import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { useSettingsLoader } from '../../hooks/useSettings';
import LoginPage from './pages/LoginPage';
import PosPage from './pages/PosPage';

function Protected({ children }: { children: React.ReactNode }) {
  return useAuthStore((s) => s.isAuthenticated) ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  useSettingsLoader();
  return (
    <BrowserRouter basename="/pos">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Protected><PosPage /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
