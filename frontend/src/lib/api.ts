import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: false,
});

function resolveLoginRoute(): string {
  const path = window.location.pathname;
  const moduleMatch = path.match(/^\/(admin|pos|kitchen|kiosk)(?:\/|$)/i);
  if (moduleMatch?.[1]) {
    return `/${moduleMatch[1].toLowerCase()}/login`;
  }
  return '/admin/login';
}

function prettifyField(field: string): string {
  const map: Record<string, string> = {
    name: 'nombre',
    email: 'email',
    phone: 'telefono',
    branchId: 'sucursal',
    tableId: 'mesa',
    categoryId: 'categoria',
    productId: 'producto',
    quantity: 'cantidad',
    price: 'precio',
    password: 'contrasena',
  };
  return map[field] ?? field;
}

function toFriendlyLine(line: string): string {
  if (!line) return 'Dato invalido.';

  const fieldMatch = line.match(/^[a-zA-Z0-9_]+/);
  const rawField = fieldMatch?.[0] ?? '';
  const field = rawField ? prettifyField(rawField) : 'campo';

  if (line.includes('must be an email')) return `El campo ${field} debe ser un email valido.`;
  if (line.includes('must be a UUID') || line.includes('uuid is expected')) return `El campo ${field} no tiene un formato valido.`;
  if (line.includes('must be a string')) return `El campo ${field} debe ser texto.`;
  if (line.includes('must be a number') || line.includes('must be a positive number')) return `El campo ${field} debe ser numerico.`;
  if (line.includes('must be an integer number')) return `El campo ${field} debe ser un numero entero.`;
  if (line.includes('should not be empty')) return `El campo ${field} es obligatorio.`;
  if (line.includes('must be one of the following values')) return `El campo ${field} tiene un valor no permitido.`;
  if (line.includes('must be longer than')) return `El campo ${field} es demasiado corto.`;
  if (line.includes('must be shorter than') || line.includes('must be shorter or equal')) return `El campo ${field} es demasiado largo.`;
  if (line.includes('already exists') || line.includes('duplicate key value')) return `Ya existe un registro con ese ${field}.`;

  return line;
}

function buildUserMessage(error: any): string {
  const status = error?.response?.status;
  const payload = error?.response?.data;
  const rawMessage = payload?.message;

  if (Array.isArray(rawMessage)) {
    return rawMessage.map((m) => toFriendlyLine(String(m))).join('\n');
  }

  const msg = String(rawMessage ?? error?.message ?? '').trim();

  if (status === 409) {
    if (msg) return toFriendlyLine(msg);
    return 'Ya existe un registro con esos datos. Verifica email, telefono u otros campos unicos.';
  }

  if (status === 400) {
    if (msg) return toFriendlyLine(msg);
    return 'Hay datos invalidos. Revisa los campos marcados e intenta de nuevo.';
  }

  if (status === 401) return 'Tu sesion expiro. Inicia sesion nuevamente.';
  if (status === 403) return 'No tienes permisos para realizar esta accion.';
  if (status === 404) return 'No se encontro el recurso solicitado.';
  if (status === 422) return msg ? toFriendlyLine(msg) : 'No se pudo procesar la informacion enviada.';
  if (status >= 500) return 'Ocurrio un error interno del servidor. Intenta de nuevo en unos segundos.';

  if (msg) return toFriendlyLine(msg);
  return 'Ocurrio un error inesperado.';
}

function actionLabel(method: string): string {
  if (method === 'post') return 'crear';
  if (method === 'patch' || method === 'put') return 'actualizar';
  if (method === 'delete') return 'eliminar';
  return 'guardar';
}

// Utilidad para mostrar alertas con encabezado personalizado.
export function customAlert(message: string, title: string = 'Restaurante') {
  window.alert(`${title}\n\n${message}`);
}

// Inyectar token JWT en cada petición
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Manejo automático de refresh token cuando el access token expira
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        localStorage.clear();
        window.location.href = resolveLoginRoute();
        return Promise.reject(error);
      }
      try {
        const { data } = await axios.post('/api/auth/refresh', { refreshToken });
        localStorage.setItem('access_token', data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        localStorage.clear();
        window.location.href = resolveLoginRoute();
        return Promise.reject(error);
      }
    }

    // Para mutaciones (POST/PATCH/PUT/DELETE), mostrar errores claros al usuario.
    const method = (original?.method ?? '').toLowerCase();
    const silentError = original?.headers?.['X-Silent-Error'] === '1' || original?.headers?.['x-silent-error'] === '1';
    if (method && method !== 'get') {
      if (!silentError) {
        const message = buildUserMessage(error);
        const settings = JSON.parse(localStorage.getItem('settings') || '{}');
        const systemName = settings.restaurantName || 'Restaurante';
        customAlert(`No se pudo ${actionLabel(method)}: ${message}`, systemName);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
