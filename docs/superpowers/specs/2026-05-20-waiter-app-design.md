# Waiter App — Design Spec
**Fecha:** 2026-05-20  
**Estado:** Aprobado por usuario

---

## 1. Resumen

Nueva SPA `waiter` para toma de órdenes desde móvil del mesero. Sigue el patrón arquitectónico del kiosk (quinta SPA independiente). El mesero se autentica con JWT, selecciona una mesa, opcionalmente identifica al cliente, selecciona productos y envía la orden a cocina. Puede agregar ítems a órdenes existentes y solicitar la cuenta.

---

## 2. Decisiones de diseño

| Decisión | Elección | Razón |
|---|---|---|
| Autenticación | Usuario/contraseña (JWT existente) | Respetar roles y trazabilidad por mesero |
| Mesas ocupadas | Sí permite interacción | Agregar ítems + solicitar cuenta |
| Pago | No — solo enviar orden | Cajero cobra desde POS |
| Arquitectura | Nueva SPA `waiter` | Mismo patrón que las otras 4 SPAs |
| Menú | Todos los productos activos | Sin filtro `showInKiosk` |
| Tipo de orden | DINE_IN automático para mesas | Sin pantalla de selección |

---

## 3. Flujo de pantallas

```
LOGIN → TABLES → CUSTOMER → MENU → CART → CONFIRMATION
                    ↑
         (desde mesa ocupada/waiting_food/bill_requested)
         Opciones: "Agregar ítems" → CUSTOMER → MENU → ...
                   "Solicitar cuenta" → PATCH table status
```

**Para llevar:** Botón "Para llevar" en `TABLES` → salta a `CUSTOMER` sin mesa, `OrderType.TAKEOUT`.

---

## 4. Pantallas

### 4.1 LoginScreen
- Campos: email + contraseña
- Valida que el usuario tenga rol `WAITER`, `CASHIER`, `BRANCH_ADMIN`, o `SUPER_ADMIN`
- Token JWT guardado en `localStorage` clave `waiter_token`
- `branchId` obtenido del payload del JWT (`user.branchId`) o desde query param `?branchId=`
- Si ya existe token válido al cargar la app → saltar a `TABLES`
- En error 401/403: mostrar mensaje de credenciales inválidas o permisos insuficientes
- Diseño: pantalla completa, logo del restaurante, formulario centrado, botón grande

### 4.2 TablesScreen
- Grid de tarjetas (2 columnas en móvil, 3 en tablet)
- Cada tarjeta muestra: número de mesa, nombre descriptivo, capacidad (ícono de personas), estado badge
- Colores de borde por estado:
  - `FREE` → verde (`border-green-500`)
  - `OCCUPIED` → amarillo (`border-yellow-500`)
  - `WAITING_FOOD` → naranja (`border-orange-500`)
  - `BILL_REQUESTED` → azul (`border-blue-500`)
  - `RESERVED` → gris (`border-gray-400`), no interactiva
- Al tocar mesa `FREE`: navega a `CUSTOMER`, modo nueva orden
- Al tocar mesa `OCCUPIED/WAITING_FOOD/BILL_REQUESTED`: muestra bottom sheet con opciones:
  - "Agregar ítems" → navega a `CUSTOMER`, modo adición
  - "Solicitar cuenta" (si no es ya `BILL_REQUESTED`) → PATCH inmediato + feedback toast
  - "Ver orden actual" → muestra resumen de la orden activa (ítems, total) en modal
- Botón "Para llevar" en header → navega a `CUSTOMER` sin mesa, `type=TAKEOUT`
- Botón refresh (ícono) en header → re-fetch de mesas
- Banner superior: nombre del mesero autenticado

### 4.3 CustomerScreen
- Mismo flujo que el kiosk: escanear QR / continuar como invitado
- "Invitado" es el botón primario/prominente (caso más frecuente en mesa)
- "Escanear tarjeta" abre cámara para QR del cliente
- En modo adición a orden existente: mostrar banner "Agregando a orden #X — Mesa Y"

### 4.4 MenuScreen
- Layout: header fijo + sidebar categorías (colapsable en móvil) + grid productos + bottom bar
- **Barra de búsqueda** al tope del área de productos (filtro en tiempo real, `debounce` 300ms)
- Productos sin modificadores obligatorios: tap = agrega 1 al carrito directamente (con animación de feedback)
- Productos con modificadores obligatorios: tap = abre `ProductDetailScreen`
- Badge numérico sobre cada tarjeta de producto si ya está en el carrito
- Muestra TODOS los productos activos de la sucursal (endpoint `/waiter/:branchId/menu`)
- Bottom bar: "🛒 Ver orden (N ítems) — ₡TOTAL" → navega a `CART`
- Banner de contexto si hay orden existente: "Agregando a orden #42 · Mesa 4"

### 4.5 ProductDetailScreen
- Igual al kiosk: imagen, descripción, modificadores, notas, cantidad
- Botón "Agregar al carrito"

### 4.6 CartScreen
- Lista de ítems con: nombre, modificadores elegidos, notas por ítem, cantidad (editable +/-), precio
- Botón eliminar por ítem (×)
- Campo de notas generales para la orden (alérgenos, peticiones del cliente)
- Subtotal + IVA + Total
- Si modo adición: sección "Ítems ya ordenados (referencia)" en gris/readonly, luego "Nuevos ítems"
- Botón "Enviar a cocina" (primary, grande)
- Botón "← Seguir agregando" (vuelve a MENU)

### 4.7 ConfirmationScreen
- ✅ grande + "¡Orden enviada!"
- Número de orden en grande
- Mesa asignada (si aplica)
- **Sin timer automático** (el mesero decide cuándo hacer otra orden)
- Botón primario: "Nueva orden" → vuelve a `TABLES`
- Botón secundario: "Solicitar cuenta" → solo si hay mesa asignada Y mesa no está en `BILL_REQUESTED`

---

## 5. Estado global (Zustand store)

```typescript
type WaiterScreen =
  | 'LOGIN'
  | 'TABLES'
  | 'CUSTOMER'
  | 'MENU'
  | 'PRODUCT_DETAIL'
  | 'CART'
  | 'CONFIRMATION';

interface WaiterUser {
  id: string;
  name: string;
  email: string;
  role: string;
  branchId: string;
}

interface WaiterTable {
  id: string;
  number: number;
  name: string;
  capacity: number;
  status: TableStatus;
}

interface WaiterState {
  // Auth
  token: string | null;
  user: WaiterUser | null;
  branchId: string | null;

  // Navegación
  screen: WaiterScreen;

  // Contexto de mesa y orden
  selectedTable: WaiterTable | null;
  orderMode: 'new' | 'add';         // 'add' = agregar a orden existente
  existingOrderId: string | null;
  existingOrderNumber: number | null;
  orderType: 'DINE_IN' | 'TAKEOUT';

  // Cliente
  customer: KioskCustomer | null;  // reutilizar tipo del kiosk

  // Carrito (misma estructura que kiosk)
  cart: CartItem[];
  selectedProductId: string | null;

  // Confirmación
  confirmedOrderNumber: string | null;
  confirmedOrderId: string | null;

  // Acciones
  login(token: string, user: WaiterUser): void;
  logout(): void;
  goTo(screen: WaiterScreen): void;
  selectTable(table: WaiterTable, mode: 'new' | 'add', existingOrderId?: string, existingOrderNumber?: number): void;
  setOrderType(type: 'DINE_IN' | 'TAKEOUT'): void;
  setCustomer(customer: KioskCustomer | null): void;
  selectProduct(id: string): void;
  addToCart(item: CartItem): void;
  updateCartQty(productId: string, qty: number): void;
  removeFromCart(productId: string): void;
  setConfirmedOrder(orderNumber: string, orderId: string): void;
  reset(): void;  // vuelve a TABLES, limpia carrito y contexto de mesa
}
```

---

## 6. Backend: módulo `waiter`

### 6.1 Archivos nuevos
```
backend/src/waiter/
  waiter.module.ts
  waiter.controller.ts
  waiter.service.ts
  dto/
    create-waiter-order.dto.ts   (extiende CreateOrderDto o reutiliza)
    add-order-items.dto.ts
```

### 6.2 Endpoints

Todos requieren `JwtAuthGuard`. El guard existente `RolesGuard` + `@Roles(WAITER, CASHIER, BRANCH_ADMIN, SUPER_ADMIN)`.

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/waiter/:branchId/menu` | Menú completo (todos los productos activos, con modificadores) |
| `GET` | `/waiter/:branchId/tables` | Mesas activas con estado |
| `GET` | `/waiter/tables/:tableId/active-order` | Orden activa de la mesa (status IN: pending, in_preparation, ready, delivered) |
| `POST` | `/waiter/orders` | Crear nueva orden (userId del JWT) |
| `POST` | `/waiter/orders/:orderId/items` | Agregar ítems a orden existente |
| `PATCH` | `/waiter/tables/:tableId/request-bill` | Marcar mesa como `bill_requested` |

### 6.3 `GET /waiter/:branchId/menu`
Similar a `GET /kiosk/:branchId/menu` pero:
- Sin verificar `kioskEnabled`
- Sin filtro `showInKiosk = true`
- Requiere JWT válido

Devuelve: `{ categories, products, branchConfig }` (misma forma que el kiosk para reutilizar componentes).

### 6.4 `POST /waiter/orders`
Usa `OrdersService.create()` existente. El `userId` se extrae del JWT (`@CurrentUser()` decorator).
`OrderType` = `DINE_IN` si hay `tableId`, `TAKEOUT` si no.

### 6.5 `POST /waiter/orders/:orderId/items`
Verifica que la orden pertenezca al `branchId` del mesero. Agrega ítems y recalcula totales.
Emite evento WebSocket para actualizar cocina y POS.

### 6.6 `PATCH /waiter/tables/:tableId/request-bill`
Llama a `TablesService.updateStatus(tableId, branchId, TableStatus.BILL_REQUESTED)`.
Emite evento WebSocket para notificar al POS.

---

## 7. Frontend: estructura de archivos

```
frontend/src/apps/waiter/
  App.tsx
  main.tsx
  index.html
  index.css
  store/
    waiter.store.ts
  screens/
    LoginScreen.tsx
    TablesScreen.tsx
    CustomerScreen.tsx       (adaptado del kiosk)
    MenuScreen.tsx           (nuevo, con búsqueda)
    ProductDetailScreen.tsx  (adaptado del kiosk)
    CartScreen.tsx           (adaptado del kiosk)
    ConfirmationScreen.tsx   (nuevo, sin timer)
  components/
    TableCard.tsx
    TableOptionsSheet.tsx    (bottom sheet para mesa ocupada)
    SearchBar.tsx
    ContextBanner.tsx        (mesa actual + mesero)

frontend/vite.waiter.config.ts
```

### 7.1 Ruta nginx
```nginx
location /waiter/ {
  alias /usr/share/nginx/html/waiter/;
  try_files $uri $uri/ /waiter/index.html;
}
location = /waiter {
  return 301 /waiter/;
}
```

### 7.2 Scripts package.json (agregar)
```json
"dev:waiter":   "vite --config vite.waiter.config.ts --port 5177",
"build:waiter": "tsc && vite build --config vite.waiter.config.ts",
"build:all":    "... && npm run build:waiter"
```

### 7.3 Docker frontend Dockerfile
Agregar en stage `production`:
```dockerfile
COPY --from=builder /app/dist/waiter /usr/share/nginx/html/waiter
```

---

## 8. Autenticación en el cliente

- `axios` instance con interceptor que lee `localStorage.getItem('waiter_token')` y agrega header `Authorization: Bearer <token>`
- En 401 → logout + redirect a `LOGIN`
- El `branchId` viene del payload del JWT (`user.branchId`) — no se necesita query param manual

---

## 9. Consideraciones de UX móvil

- Fuente mínima 16px para todos los inputs (evita zoom automático en iOS)
- `touch-action: manipulation` en botones (elimina delay de 300ms)
- Scroll suave en listas largas (`overflow-y-auto` con `-webkit-overflow-scrolling: touch`)
- Bottom bar siempre fija, no se superpone con el contenido scrollable
- Safe area padding para dispositivos con notch (`env(safe-area-inset-*)`)

---

## 10. Lo que NO entra en este scope

- Gestión de pagos (queda en POS)
- Editar/cancelar ítems de la orden existente (solo agregar nuevos)
- Asignar/reasignar mesero a mesa
- Notificaciones push
- Modo offline
