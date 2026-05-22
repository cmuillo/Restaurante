# Waiter App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear la app móvil `waiter` (quinta SPA) para que el mesero tome órdenes, seleccione mesas, agregue ítems a órdenes existentes y solicite la cuenta.

**Architecture:** Nueva SPA independiente en `frontend/src/apps/waiter/` siguiendo el mismo patrón de las otras 4 SPAs. Backend agrega módulo `waiter` con endpoints JWT-protegidos que reutilizan servicios existentes (`OrdersService`, `TablesService`). Un nuevo método `addItemsToOrder` en `OrdersService` permite agregar ítems a órdenes activas.

**Tech Stack:** NestJS + TypeORM (backend), React + Vite + Zustand + TanStack Query + Tailwind CSS (frontend), JWT existente para auth.

**Spec:** `docs/superpowers/specs/2026-05-20-waiter-app-design.md`

---

## Mapa de archivos

### Backend (crear)
- `backend/src/waiter/waiter.module.ts`
- `backend/src/waiter/waiter.controller.ts`
- `backend/src/waiter/waiter.service.ts`
- `backend/src/waiter/dto/add-order-items.dto.ts`

### Backend (modificar)
- `backend/src/orders/orders.service.ts` — agregar método `addItemsToOrder`
- `backend/src/orders/orders.module.ts` — exportar `OrdersService` (verificar)
- `backend/src/app.module.ts` — registrar `WaiterModule`

### Frontend (crear)
- `frontend/src/apps/waiter/index.html`
- `frontend/src/apps/waiter/index.css`
- `frontend/src/apps/waiter/main.tsx`
- `frontend/src/apps/waiter/App.tsx`
- `frontend/src/apps/waiter/store/waiter.store.ts`
- `frontend/src/apps/waiter/lib/waiter-api.ts`
- `frontend/src/apps/waiter/screens/LoginScreen.tsx`
- `frontend/src/apps/waiter/screens/TablesScreen.tsx`
- `frontend/src/apps/waiter/screens/CustomerScreen.tsx`
- `frontend/src/apps/waiter/screens/MenuScreen.tsx`
- `frontend/src/apps/waiter/screens/ProductDetailScreen.tsx`
- `frontend/src/apps/waiter/screens/CartScreen.tsx`
- `frontend/src/apps/waiter/screens/ConfirmationScreen.tsx`
- `frontend/vite.waiter.config.ts`

### Frontend (modificar)
- `frontend/package.json` — agregar scripts `dev:waiter` y `build:waiter`, actualizar `build:all`
- `frontend/nginx.conf.template` — agregar location `/waiter/`
- `frontend/Dockerfile` — copiar `dist/waiter` en stage production

---

## Task 1: Backend — método `addItemsToOrder` en OrdersService

**Files:**
- Modify: `backend/src/orders/orders.service.ts`

- [ ] **Step 1: Agregar método `addItemsToOrder` al final de `OrdersService`**

Abrir `backend/src/orders/orders.service.ts`. Localizar el último método de la clase (antes del cierre `}`). Añadir después del último método:

```typescript
  /**
   * Agrega ítems a una orden existente y recalcula los totales.
   * Solo se puede agregar a órdenes en estado PENDING, IN_PREPARATION, READY o DELIVERED.
   */
  async addItemsToOrder(
    orderId: string,
    branchId: string,
    items: CreateOrderItemDto[],
    userId?: string,
  ): Promise<Order> {
    const order = await this.findOne(orderId, branchId);

    const notAddable: OrderStatus[] = [OrderStatus.CANCELLED, OrderStatus.COMPLETED];
    if (notAddable.includes(order.status)) {
      throw new BadRequestException(
        `No se pueden agregar ítems a una orden en estado ${order.status}`,
      );
    }

    const uniqueProductIds = [...new Set(items.map((i) => i.productId))];
    const products = await this.productRepository.findBy({ id: In(uniqueProductIds) });
    const productsById = new Map(products.map((p) => [p.id, p]));

    const newItems: Partial<OrderItem>[] = items.map((item) => {
      const product = productsById.get(item.productId);
      if (!product) throw new BadRequestException(`Producto no encontrado: ${item.productId}`);

      const lineTaxRate = product.taxRate == null ? order.taxPercentage : Number(product.taxRate);
      const modifiers: Partial<OrderItemModifier>[] = (item.modifiers ?? []).map((m) => ({
        modifierOptionId: m.modifierOptionId,
        optionName: m.optionName,
        extraPrice: m.extraPrice,
      }));

      return {
        orderId: order.id,
        productId: item.productId,
        productName: item.productName,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        subtotal: item.unitPrice * item.quantity,
        notes: item.notes,
        cabysCode: product.cabysCode,
        commercialCodeType: product.commercialCodeType,
        commercialCode: product.commercialCode,
        taxCode: product.taxCode,
        taxRate: lineTaxRate,
        unitOfMeasure: product.unitOfMeasure,
        isBar: product.isBar ?? false,
        modifiers: modifiers as OrderItemModifier[],
      };
    });

    await this.dataSource.transaction(async (manager) => {
      await manager.save(OrderItem, newItems as OrderItem[]);

      // Recalcular totales de la orden
      const allItems = await manager.find(OrderItem, {
        where: { orderId: order.id },
        relations: ['modifiers'],
      });

      let subtotal = 0;
      let taxAmount = 0;
      for (const it of allItems) {
        const lineSubtotal = Number(it.unitPrice) * it.quantity
          + (it.modifiers ?? []).reduce((s, m) => s + Number(m.extraPrice) * it.quantity, 0);
        const lineTax = lineSubtotal * (Number(it.taxRate) / 100);
        subtotal += lineSubtotal;
        taxAmount += lineTax;
      }

      const effectiveTaxPct = subtotal > 0 ? (taxAmount / subtotal) * 100 : 0;
      const tipAmt = subtotal * (Number(order.tipPercentage) / 100);
      const total = subtotal + taxAmount + tipAmt - Number(order.discountAmount);

      await manager.update(Order, { id: order.id }, {
        subtotal,
        taxPercentage: effectiveTaxPct,
        taxAmount,
        total,
      });
    });

    const updated = await this.findOne(orderId, branchId);

    this.gateway.emitNewOrder(branchId, {
      id: updated.id,
      orderNumber: updated.orderNumber,
      type: updated.type,
      tableId: updated.tableId,
      items: items,
      createdAt: updated.createdAt,
    });

    await this.auditService.log({
      branchId,
      userId,
      action: 'order.addItems',
      entity: 'Order',
      entityId: order.id,
      newValue: { itemsAdded: items.length },
    });

    return updated;
  }
```

- [ ] **Step 2: Verificar que `OrderItem` y `OrderItemModifier` están importados en `orders.service.ts`**

Buscar al inicio del archivo las importaciones. Deben existir:
```typescript
import { OrderItem } from './entities/order-item.entity';
import { OrderItemModifier } from './entities/order-item-modifier.entity';
import { CreateOrderItemDto } from './dto/create-order.dto';
```
Si falta alguna, añadirla en el bloque de imports correspondiente.

- [ ] **Step 3: Verificar que `OrdersModule` exporta `OrdersService`**

Abrir `backend/src/orders/orders.module.ts`. Verificar que `exports: [OrdersService]` está presente. Si no, añadirlo.

- [ ] **Step 4: Commit**

```bash
git add backend/src/orders/orders.service.ts backend/src/orders/orders.module.ts
git commit -m "feat(orders): add addItemsToOrder method to OrdersService"
```

---

## Task 2: Backend — módulo `waiter`

**Files:**
- Create: `backend/src/waiter/dto/add-order-items.dto.ts`
- Create: `backend/src/waiter/waiter.service.ts`
- Create: `backend/src/waiter/waiter.controller.ts`
- Create: `backend/src/waiter/waiter.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Crear `add-order-items.dto.ts`**

```typescript
// backend/src/waiter/dto/add-order-items.dto.ts
import { IsArray, IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateOrderItemDto } from '../../orders/dto/create-order.dto';

export class AddOrderItemsDto {
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
```

- [ ] **Step 2: Crear `waiter.service.ts`**

```typescript
// backend/src/waiter/waiter.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Category } from '../menu/entities/category.entity';
import { Branch } from '../branches/entities/branch.entity';
import { BranchConfig } from '../branches/entities/branch-config.entity';
import { Table, TableStatus } from '../tables/entities/table.entity';
import { Order, OrderStatus, OrderType } from '../orders/entities/order.entity';
import { CreateOrderDto } from '../orders/dto/create-order.dto';
import { AddOrderItemsDto } from './dto/add-order-items.dto';
import { OrdersService } from '../orders/orders.service';
import { TablesService } from '../tables/tables.service';

@Injectable()
export class WaiterService {
  constructor(
    @InjectRepository(Category) private readonly categoryRepo: Repository<Category>,
    @InjectRepository(Branch) private readonly branchRepo: Repository<Branch>,
    @InjectRepository(BranchConfig) private readonly configRepo: Repository<BranchConfig>,
    @InjectRepository(Table) private readonly tableRepo: Repository<Table>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    private readonly ordersService: OrdersService,
    private readonly tablesService: TablesService,
  ) {}

  /** Menú completo de la sucursal (todos los productos activos, sin filtro showInKiosk). */
  async getMenu(branchId: string) {
    const branch = await this.branchRepo.findOne({ where: { id: branchId, isActive: true } });
    if (!branch) throw new NotFoundException('Sucursal no encontrada o inactiva');

    const config = await this.configRepo.findOne({ where: { branchId } });

    const categories = await this.categoryRepo
      .createQueryBuilder('cat')
      .leftJoinAndSelect('cat.products', 'product', 'product.isActive = true')
      .leftJoinAndSelect('product.modifiers', 'modifier')
      .leftJoinAndSelect('modifier.options', 'option', 'option.isActive = true')
      .where('cat.branchId = :branchId', { branchId })
      .andWhere('cat.isActive = true')
      .orderBy('cat.sortOrder', 'ASC')
      .addOrderBy('product.sortOrder', 'ASC')
      .getMany();

    const products = categories.flatMap((cat) =>
      (cat.products ?? []).map((p) => ({ ...p, categoryId: cat.id })),
    );

    return {
      branch: { id: branch.id, name: branch.name },
      branchConfig: {
        currency: config?.currency ?? 'CRC',
        taxPercentage: config?.taxPercentage ?? 13,
        tipPercentage: config?.tipPercentage ?? 0,
      },
      categories: categories.map(({ products: _p, ...cat }) => cat),
      products,
    };
  }

  /** Mesas activas de la sucursal con estado. */
  getTables(branchId: string) {
    return this.tablesService.findAll(branchId);
  }

  /** Orden activa de la mesa (PENDING, IN_PREPARATION, READY o DELIVERED). */
  async getActiveOrder(tableId: string, branchId: string) {
    const order = await this.orderRepo.findOne({
      where: {
        tableId,
        branchId,
        type: OrderType.DINE_IN,
        status: In([
          OrderStatus.PENDING,
          OrderStatus.IN_PREPARATION,
          OrderStatus.READY,
          OrderStatus.DELIVERED,
        ]),
      },
      relations: ['items', 'items.modifiers'],
      order: { createdAt: 'DESC' },
    });
    return order ?? null;
  }

  /** Crear nueva orden (userId viene del JWT). */
  createOrder(dto: CreateOrderDto, userId: string) {
    return this.ordersService.create(dto, userId);
  }

  /** Agregar ítems a orden existente. */
  addItemsToOrder(orderId: string, branchId: string, dto: AddOrderItemsDto, userId: string) {
    return this.ordersService.addItemsToOrder(orderId, branchId, dto.items, userId);
  }

  /** Solicitar cuenta: cambia estado de la mesa a bill_requested. */
  requestBill(tableId: string, branchId: string, waiterId: string) {
    return this.tablesService.updateStatus(tableId, branchId, TableStatus.BILL_REQUESTED, waiterId);
  }
}
```

- [ ] **Step 3: Crear `waiter.controller.ts`**

```typescript
// backend/src/waiter/waiter.controller.ts
import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BranchScopeGuard } from '../auth/guards/branch-scope.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { WaiterService } from './waiter.service';
import { CreateOrderDto } from '../orders/dto/create-order.dto';
import { AddOrderItemsDto } from './dto/add-order-items.dto';

@ApiTags('Waiter')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, BranchScopeGuard)
@Roles(UserRole.WAITER, UserRole.CASHIER, UserRole.BRANCH_ADMIN, UserRole.SUPER_ADMIN)
@Controller('waiter')
export class WaiterController {
  constructor(private readonly waiterService: WaiterService) {}

  @Get(':branchId/menu')
  @ApiOperation({ summary: 'Menú completo para el mesero (todos los productos activos)' })
  getMenu(@Param('branchId', ParseUUIDPipe) branchId: string) {
    return this.waiterService.getMenu(branchId);
  }

  @Get(':branchId/tables')
  @ApiOperation({ summary: 'Mesas activas de la sucursal' })
  getTables(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Query('branchId') _qBranchId?: string, // BranchScopeGuard lo usa desde query
  ) {
    return this.waiterService.getTables(branchId);
  }

  @Get('tables/:tableId/active-order')
  @ApiOperation({ summary: 'Orden activa de la mesa' })
  getActiveOrder(
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Query('branchId', ParseUUIDPipe) branchId: string,
  ) {
    return this.waiterService.getActiveOrder(tableId, branchId);
  }

  @Post('orders')
  @ApiOperation({ summary: 'Crear nueva orden' })
  createOrder(@Body() dto: CreateOrderDto, @CurrentUser() user: any) {
    return this.waiterService.createOrder(dto, user.id);
  }

  @Post('orders/:orderId/items')
  @ApiOperation({ summary: 'Agregar ítems a orden existente' })
  addItems(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: AddOrderItemsDto,
    @CurrentUser() user: any,
  ) {
    return this.waiterService.addItemsToOrder(orderId, branchId, dto, user.id);
  }

  @Patch('tables/:tableId/request-bill')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Solicitar cuenta — cambia estado de mesa a bill_requested' })
  requestBill(
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @CurrentUser() user: any,
  ) {
    return this.waiterService.requestBill(tableId, branchId, user.id);
  }
}
```

- [ ] **Step 4: Crear `waiter.module.ts`**

```typescript
// backend/src/waiter/waiter.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WaiterController } from './waiter.controller';
import { WaiterService } from './waiter.service';
import { Category } from '../menu/entities/category.entity';
import { Branch } from '../branches/entities/branch.entity';
import { BranchConfig } from '../branches/entities/branch-config.entity';
import { Table } from '../tables/entities/table.entity';
import { Order } from '../orders/entities/order.entity';
import { OrdersModule } from '../orders/orders.module';
import { TablesModule } from '../tables/tables.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Category, Branch, BranchConfig, Table, Order]),
    OrdersModule,
    TablesModule,
  ],
  controllers: [WaiterController],
  providers: [WaiterService],
})
export class WaiterModule {}
```

- [ ] **Step 5: Verificar que `TablesModule` exporta `TablesService`**

Abrir `backend/src/tables/tables.module.ts`. Añadir `exports: [TablesService]` si no existe.

- [ ] **Step 6: Registrar `WaiterModule` en `app.module.ts`**

En `backend/src/app.module.ts`, añadir:

```typescript
import { WaiterModule } from './waiter/waiter.module';
```

Y dentro del array `imports`, después de `KioskModule`:

```typescript
WaiterModule,
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/waiter/ backend/src/app.module.ts backend/src/tables/tables.module.ts
git commit -m "feat(waiter): add WaiterModule with menu, tables, orders endpoints"
```

---

## Task 3: Frontend — scaffolding (config, nginx, Docker, package.json)

**Files:**
- Create: `frontend/vite.waiter.config.ts`
- Modify: `frontend/package.json`
- Modify: `frontend/nginx.conf.template`
- Modify: `frontend/Dockerfile`

- [ ] **Step 1: Crear `vite.waiter.config.ts`**

```typescript
// frontend/vite.waiter.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/waiter/',
  root: 'src/apps/waiter',
  build: { outDir: '../../../dist/waiter', emptyOutDir: true },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: process.env.VITE_WS_TARGET ?? 'ws://localhost:3000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 2: Actualizar `package.json`**

En `frontend/package.json`, en la sección `scripts`:
- Añadir `"dev:waiter": "vite --config vite.waiter.config.ts --port 5177"`
- Añadir `"build:waiter": "tsc && vite build --config vite.waiter.config.ts"`
- Actualizar `"build:all"` para incluir `&& npm run build:waiter` al final

- [ ] **Step 3: Actualizar `nginx.conf.template`**

Añadir antes del bloque `# Redirigir raíz a admin`:

```nginx
    # Waiter (app móvil del mesero)
    location /waiter/ {
        alias /usr/share/nginx/html/waiter/;
        try_files $uri $uri/ /waiter/index.html;
    }

    location = /waiter {
        return 301 /waiter/;
    }
```

- [ ] **Step 4: Actualizar `frontend/Dockerfile`**

En el stage `production`, después de la línea `COPY --from=builder /app/dist/kiosk /usr/share/nginx/html/kiosk`, añadir:

```dockerfile
COPY --from=builder /app/dist/waiter /usr/share/nginx/html/waiter
```

- [ ] **Step 5: Commit**

```bash
git add frontend/vite.waiter.config.ts frontend/package.json frontend/nginx.conf.template frontend/Dockerfile
git commit -m "feat(waiter): add Vite config, nginx route, Docker stage for waiter SPA"
```

---

## Task 4: Frontend — archivos base de la app waiter

**Files:**
- Create: `frontend/src/apps/waiter/index.html`
- Create: `frontend/src/apps/waiter/index.css`
- Create: `frontend/src/apps/waiter/main.tsx`
- Create: `frontend/src/apps/waiter/lib/waiter-api.ts`

- [ ] **Step 1: Crear `index.html`**

```html
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
    <title>Mesero — Restaurante</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Crear `index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }

body {
  font-family: 'Inter', system-ui, sans-serif;
  @apply bg-gray-50 text-gray-900 overflow-hidden select-none;
  width: 100vw;
  height: 100dvh; /* dynamic viewport height para móvil */
  padding-bottom: env(safe-area-inset-bottom);
}

#root {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}
```

- [ ] **Step 3: Crear `main.tsx`**

```tsx
// frontend/src/apps/waiter/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
```

- [ ] **Step 4: Crear `lib/waiter-api.ts`**

Axios instance con interceptor JWT que lee `waiter_token` de localStorage. En 401 limpia token y recarga a la pantalla de login.

```typescript
// frontend/src/apps/waiter/lib/waiter-api.ts
import axios from 'axios';

const waiterApi = axios.create({
  baseURL: '/api',
  withCredentials: false,
});

waiterApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('waiter_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

waiterApi.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('waiter_token');
      window.location.reload();
    }
    return Promise.reject(error);
  },
);

export default waiterApi;
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/apps/waiter/index.html frontend/src/apps/waiter/index.css frontend/src/apps/waiter/main.tsx frontend/src/apps/waiter/lib/
git commit -m "feat(waiter): add base HTML, CSS, main.tsx and API client"
```

---

## Task 5: Frontend — Zustand store

**Files:**
- Create: `frontend/src/apps/waiter/store/waiter.store.ts`

- [ ] **Step 1: Crear `waiter.store.ts`**

```typescript
// frontend/src/apps/waiter/store/waiter.store.ts
import { create } from 'zustand';

export type WaiterScreen =
  | 'LOGIN'
  | 'TABLES'
  | 'CUSTOMER'
  | 'MENU'
  | 'PRODUCT_DETAIL'
  | 'CART'
  | 'CONFIRMATION';

export interface WaiterUser {
  id: string;
  name: string;
  email: string;
  role: string;
  branchId: string;
}

export interface WaiterTable {
  id: string;
  number: number;
  name: string | null;
  capacity: number;
  status: string;
}

export interface CartItem {
  productId: string;
  productName: string;
  price: number;       // precio BASE sin IVA
  taxRate: number;
  quantity: number;
  notes?: string;
  modifiers: { modifierOptionId: string; optionName: string; extraPrice: number }[];
}

export interface WaiterCustomer {
  id: string;
  code: string;
  name: string;
  loyaltyPoints: number;
  isExempt?: boolean;
}

interface WaiterState {
  // Auth
  token: string | null;
  user: WaiterUser | null;

  // Navegación
  screen: WaiterScreen;

  // Contexto de mesa y orden
  selectedTable: WaiterTable | null;
  orderMode: 'new' | 'add';
  existingOrderId: string | null;
  existingOrderNumber: number | null;
  orderType: 'DINE_IN' | 'TAKEOUT';

  // Cliente
  customer: WaiterCustomer | null;

  // Carrito
  cart: CartItem[];
  selectedProductId: string | null;

  // Confirmación
  confirmedOrderNumber: string | null;
  confirmedOrderId: string | null;

  // Acciones
  login: (token: string, user: WaiterUser) => void;
  logout: () => void;
  goTo: (screen: WaiterScreen) => void;
  selectTable: (
    table: WaiterTable,
    mode: 'new' | 'add',
    existingOrderId?: string,
    existingOrderNumber?: number,
  ) => void;
  setOrderType: (type: 'DINE_IN' | 'TAKEOUT') => void;
  setCustomer: (customer: WaiterCustomer | null) => void;
  selectProduct: (id: string) => void;
  addToCart: (item: CartItem) => void;
  updateCartQty: (productId: string, qty: number) => void;
  removeFromCart: (productId: string) => void;
  setConfirmedOrder: (orderNumber: string, orderId: string) => void;
  reset: () => void;
}

function decodeJwtPayload(token: string): WaiterUser | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      id: payload.sub,
      name: payload.name ?? payload.email,
      email: payload.email,
      role: payload.role,
      branchId: payload.branchId,
    };
  } catch {
    return null;
  }
}

const storedToken = localStorage.getItem('waiter_token');
const storedUser = storedToken ? decodeJwtPayload(storedToken) : null;

export const useWaiterStore = create<WaiterState>((set) => ({
  token: storedToken,
  user: storedUser,
  screen: storedToken && storedUser ? 'TABLES' : 'LOGIN',

  selectedTable: null,
  orderMode: 'new',
  existingOrderId: null,
  existingOrderNumber: null,
  orderType: 'DINE_IN',

  customer: null,
  cart: [],
  selectedProductId: null,
  confirmedOrderNumber: null,
  confirmedOrderId: null,

  login: (token, user) => {
    localStorage.setItem('waiter_token', token);
    set({ token, user, screen: 'TABLES' });
  },

  logout: () => {
    localStorage.removeItem('waiter_token');
    set({
      token: null, user: null, screen: 'LOGIN',
      selectedTable: null, cart: [], customer: null,
    });
  },

  goTo: (screen) => set({ screen }),

  selectTable: (table, mode, existingOrderId, existingOrderNumber) =>
    set({
      selectedTable: table,
      orderMode: mode,
      existingOrderId: existingOrderId ?? null,
      existingOrderNumber: existingOrderNumber ?? null,
      orderType: 'DINE_IN',
      cart: [],
      customer: null,
    }),

  setOrderType: (orderType) => set({ orderType }),

  setCustomer: (customer) => set({ customer }),

  selectProduct: (selectedProductId) => set({ selectedProductId, screen: 'PRODUCT_DETAIL' }),

  addToCart: (item) =>
    set((s) => {
      const existing = s.cart.find(
        (c) => c.productId === item.productId &&
          JSON.stringify(c.modifiers) === JSON.stringify(item.modifiers),
      );
      if (existing) {
        return {
          cart: s.cart.map((c) =>
            c === existing ? { ...c, quantity: c.quantity + item.quantity } : c,
          ),
        };
      }
      return { cart: [...s.cart, item] };
    }),

  updateCartQty: (productId, qty) =>
    set((s) => ({
      cart: qty <= 0
        ? s.cart.filter((c) => c.productId !== productId)
        : s.cart.map((c) => c.productId === productId ? { ...c, quantity: qty } : c),
    })),

  removeFromCart: (productId) =>
    set((s) => ({ cart: s.cart.filter((c) => c.productId !== productId) })),

  setConfirmedOrder: (confirmedOrderNumber, confirmedOrderId) =>
    set({ confirmedOrderNumber, confirmedOrderId, screen: 'CONFIRMATION' }),

  reset: () =>
    set({
      screen: 'TABLES',
      selectedTable: null,
      orderMode: 'new',
      existingOrderId: null,
      existingOrderNumber: null,
      orderType: 'DINE_IN',
      customer: null,
      cart: [],
      selectedProductId: null,
      confirmedOrderNumber: null,
      confirmedOrderId: null,
    }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/apps/waiter/store/
git commit -m "feat(waiter): add Zustand store with auth, table, cart state"
```

---

## Task 6: Frontend — LoginScreen

**Files:**
- Create: `frontend/src/apps/waiter/screens/LoginScreen.tsx`

- [ ] **Step 1: Crear `LoginScreen.tsx`**

```tsx
// frontend/src/apps/waiter/screens/LoginScreen.tsx
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
    mutationFn: () => waiterApi.post('/auth/login', { email, password }).then((r) => r.data),
    onSuccess: (data: { access_token: string }) => {
      const token = data.access_token;
      // Decodificar payload para verificar rol
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const allowedRoles = ['waiter', 'cashier', 'branch_admin', 'super_admin'];
        if (!allowedRoles.includes(payload.role)) {
          setError('Tu cuenta no tiene permisos para usar esta app.');
          return;
        }
        login(token, {
          id: payload.sub,
          name: payload.name ?? payload.email,
          email: payload.email,
          role: payload.role,
          branchId: payload.branchId,
        });
      } catch {
        setError('Error al procesar la sesión. Intenta de nuevo.');
      }
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
      {/* Logo */}
      <div className="flex flex-col items-center gap-3">
        {settings.logoBase64
          ? <img src={settings.logoBase64} alt={settings.restaurantName} className="h-16 object-contain" />
          : <span className="text-5xl">🍽️</span>
        }
        <h1 className="text-2xl font-black text-gray-900">{settings.restaurantName || 'Restaurante'}</h1>
        <p className="text-gray-500 text-base">App del mesero</p>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Correo electrónico</label>
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/apps/waiter/screens/LoginScreen.tsx
git commit -m "feat(waiter): add LoginScreen with JWT auth and role validation"
```

---

## Task 7: Frontend — TablesScreen

**Files:**
- Create: `frontend/src/apps/waiter/screens/TablesScreen.tsx`

- [ ] **Step 1: Crear `TablesScreen.tsx`**

```tsx
// frontend/src/apps/waiter/screens/TablesScreen.tsx
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import waiterApi from '../lib/waiter-api';
import { useWaiterStore, type WaiterTable } from '../store/waiter.store';
import { useSettings } from '../../../hooks/useSettings';

const STATUS_LABELS: Record<string, string> = {
  free: 'Libre',
  occupied: 'Ocupada',
  waiting_food: 'Esperando',
  bill_requested: 'Cuenta',
  reserved: 'Reservada',
};

const STATUS_COLORS: Record<string, string> = {
  free: 'border-green-400 bg-green-50',
  occupied: 'border-yellow-400 bg-yellow-50',
  waiting_food: 'border-orange-400 bg-orange-50',
  bill_requested: 'border-blue-400 bg-blue-50',
  reserved: 'border-gray-300 bg-gray-100',
};

const STATUS_BADGE: Record<string, string> = {
  free: 'bg-green-100 text-green-700',
  occupied: 'bg-yellow-100 text-yellow-700',
  waiting_food: 'bg-orange-100 text-orange-700',
  bill_requested: 'bg-blue-100 text-blue-700',
  reserved: 'bg-gray-200 text-gray-600',
};

type Sheet = { table: WaiterTable; activeOrderId?: string; activeOrderNumber?: number } | null;

export default function TablesScreen() {
  const { user, goTo, selectTable, setOrderType, logout } = useWaiterStore();
  const settings = useSettings();
  const branchId = user?.branchId ?? '';
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const { data: tables = [], refetch, isFetching } = useQuery<WaiterTable[]>({
    queryKey: ['waiter-tables', branchId],
    queryFn: () => waiterApi.get(`/waiter/${branchId}/tables`).then((r) => r.data),
    enabled: !!branchId,
    refetchInterval: 30_000,
  });

  const requestBillMutation = useMutation({
    mutationFn: (tableId: string) =>
      waiterApi.patch(`/waiter/tables/${tableId}/request-bill?branchId=${branchId}`),
    onSuccess: () => {
      showToast('¡Cuenta solicitada al cajero!');
      setSheet(null);
      refetch();
    },
  });

  const handleTableTap = async (table: WaiterTable) => {
    if (table.status === 'reserved') return; // no interactiva

    if (table.status === 'free') {
      selectTable(table, 'new');
      goTo('CUSTOMER');
      return;
    }

    // Mesa ocupada — buscar orden activa
    try {
      const res = await waiterApi.get(
        `/waiter/tables/${table.id}/active-order?branchId=${branchId}`,
      );
      const order = res.data;
      setSheet({
        table,
        activeOrderId: order?.id,
        activeOrderNumber: order?.orderNumber,
      });
    } catch {
      setSheet({ table });
    }
  };

  const handleAddItems = () => {
    if (!sheet) return;
    selectTable(
      sheet.table,
      sheet.activeOrderId ? 'add' : 'new',
      sheet.activeOrderId,
      sheet.activeOrderNumber,
    );
    setSheet(null);
    goTo('CUSTOMER');
  };

  const handleTakeaway = () => {
    setOrderType('TAKEOUT');
    selectTable({ id: '', number: 0, name: null, capacity: 0, status: 'free' }, 'new');
    goTo('CUSTOMER');
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-2">
          {settings.logoBase64
            ? <img src={settings.logoBase64} alt="" className="h-8 object-contain" />
            : <span className="text-2xl">🍽️</span>
          }
          <div>
            <p className="text-xs text-gray-500 leading-none">Mesero</p>
            <p className="text-sm font-bold text-gray-900 leading-tight">{user?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 active:scale-95 transition-all"
            title="Actualizar"
          >
            {isFetching ? '⏳' : '🔄'}
          </button>
          <button
            onClick={handleTakeaway}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 text-white rounded-xl text-sm font-semibold active:scale-95 transition-all"
          >
            🛍️ Para llevar
          </button>
          <button
            onClick={logout}
            className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 active:scale-95 transition-all text-sm"
            title="Cerrar sesión"
          >
            🚪
          </button>
        </div>
      </div>

      {/* Grid de mesas */}
      <div className="flex-1 overflow-y-auto p-4">
        <h2 className="text-lg font-bold text-gray-800 mb-3">Mesas</h2>
        {tables.length === 0 ? (
          <p className="text-center text-gray-400 mt-16 text-base">No hay mesas configuradas</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {tables.map((table) => (
              <button
                key={table.id}
                onClick={() => handleTableTap(table)}
                disabled={table.status === 'reserved'}
                className={`relative flex flex-col items-center justify-center rounded-2xl border-2 p-4 gap-1 min-h-[110px] transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${STATUS_COLORS[table.status] ?? 'border-gray-200 bg-white'}`}
              >
                <span className="text-3xl font-black text-gray-800">
                  {table.number}
                </span>
                {table.name && (
                  <span className="text-xs text-gray-500 text-center leading-tight">{table.name}</span>
                )}
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  👥 {table.capacity}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold mt-1 ${STATUS_BADGE[table.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {STATUS_LABELS[table.status] ?? table.status}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bottom sheet para mesa ocupada */}
      {sheet && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setSheet(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white rounded-t-3xl p-6 flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-2" />
            <h3 className="text-lg font-bold text-gray-900 text-center">
              Mesa {sheet.table.number}
              {sheet.table.name ? ` · ${sheet.table.name}` : ''}
            </h3>
            {sheet.activeOrderNumber && (
              <p className="text-sm text-center text-gray-500">Orden activa #{sheet.activeOrderNumber}</p>
            )}
            <button
              onClick={handleAddItems}
              className="w-full bg-brand-600 hover:bg-brand-500 active:scale-95 text-white font-bold rounded-2xl py-4 text-base transition-all"
            >
              ➕ Agregar ítems
            </button>
            {sheet.table.status !== 'bill_requested' && (
              <button
                onClick={() => requestBillMutation.mutate(sheet.table.id)}
                disabled={requestBillMutation.isPending}
                className="w-full bg-blue-50 hover:bg-blue-100 active:scale-95 text-blue-700 font-bold rounded-2xl py-4 text-base transition-all disabled:opacity-50"
              >
                🧾 Solicitar cuenta
              </button>
            )}
            <button
              onClick={() => setSheet(null)}
              className="w-full bg-gray-100 text-gray-600 font-semibold rounded-2xl py-3 text-base"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/apps/waiter/screens/TablesScreen.tsx
git commit -m "feat(waiter): add TablesScreen with status grid and bottom sheet"
```

---

## Task 8: Frontend — CustomerScreen

**Files:**
- Create: `frontend/src/apps/waiter/screens/CustomerScreen.tsx`

- [ ] **Step 1: Crear `CustomerScreen.tsx`**

Versión adaptada del kiosk. La diferencia principal: el botón "Continuar como invitado" es el primario (más visible), y hay un banner si el mesero está en modo de adición a orden existente.

```tsx
// frontend/src/apps/waiter/screens/CustomerScreen.tsx
import { useRef, useState, useEffect, useCallback } from 'react';
import jsQR from 'jsqr';
import { useMutation } from '@tanstack/react-query';
import waiterApi from '../lib/waiter-api';
import { useWaiterStore, type WaiterCustomer } from '../store/waiter.store';

type QrStatus = 'idle' | 'starting' | 'scanning' | 'found' | 'error';

export default function CustomerScreen() {
  const { setCustomer, goTo, orderMode, existingOrderNumber, selectedTable } = useWaiterStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [scanning, setScanning] = useState(false);
  const [qrStatus, setQrStatus] = useState<QrStatus>('idle');
  const [foundCustomer, setFoundCustomer] = useState<WaiterCustomer | null>(null);
  const [qrError, setQrError] = useState('');

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setScanning(false);
  }, []);

  const { mutate: lookupCustomer } = useMutation({
    mutationFn: (code: string) =>
      waiterApi.get(`/kiosk/customers/code/${encodeURIComponent(code)}`).then((r) => r.data),
    onSuccess: (data) => {
      setQrStatus('found');
      setFoundCustomer(data);
      stopCamera();
    },
    onError: () => {
      setQrStatus('error');
      setQrError('Cliente no encontrado. Verifica el código QR.');
      stopCamera();
    },
  });

  const startCamera = async () => {
    setQrError('');
    setQrStatus('starting');
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setQrStatus('scanning');
    } catch {
      setQrStatus('error');
      setQrError('No se pudo acceder a la cámara.');
      setScanning(false);
    }
  };

  useEffect(() => {
    if (!scanning || !streamRef.current) return;
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = streamRef.current;
    video.muted = true;
    video.play().catch(() => {});
  }, [scanning]);

  useEffect(() => {
    if (qrStatus !== 'scanning') return;
    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(tick);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')!.drawImage(video, 0, 0);
      const imageData = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code?.data) {
        lookupCustomer(code.data);
        return;
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [qrStatus, lookupCustomer]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const handleContinueAsGuest = () => {
    setCustomer(null);
    goTo('MENU');
  };

  const handleConfirmCustomer = () => {
    if (foundCustomer) {
      setCustomer(foundCustomer);
      goTo('MENU');
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
        <button onClick={() => goTo('TABLES')} className="text-gray-500 text-2xl p-1">←</button>
        <div>
          <p className="text-base font-bold text-gray-900">
            {selectedTable?.number ? `Mesa ${selectedTable.number}` : 'Para llevar'}
          </p>
          {orderMode === 'add' && existingOrderNumber && (
            <p className="text-xs text-brand-600 font-medium">Agregando a orden #{existingOrderNumber}</p>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
        <h2 className="text-xl font-bold text-gray-900 text-center">Identificar cliente</h2>
        <p className="text-gray-500 text-sm text-center">Escanea el código QR de la tarjeta del cliente, o continúa sin identificarlo.</p>

        {/* Estado de escaneo */}
        {scanning && (
          <div className="w-full max-w-xs relative">
            <video ref={videoRef} playsInline className="w-full rounded-2xl bg-black" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-48 h-48 border-4 border-brand-400 rounded-2xl opacity-70" />
            </div>
            <button
              onClick={stopCamera}
              className="absolute top-3 right-3 bg-white/80 rounded-full w-9 h-9 flex items-center justify-center text-gray-700 font-bold text-lg"
            >
              ×
            </button>
          </div>
        )}

        {qrStatus === 'found' && foundCustomer && (
          <div className="w-full max-w-xs bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
            <p className="text-2xl mb-2">✅</p>
            <p className="font-bold text-gray-900">{foundCustomer.name}</p>
            <p className="text-sm text-gray-500">{foundCustomer.loyaltyPoints} puntos</p>
            <button
              onClick={handleConfirmCustomer}
              className="mt-4 w-full bg-brand-600 text-white font-bold rounded-xl py-3 active:scale-95 transition-all"
            >
              Confirmar cliente
            </button>
          </div>
        )}

        {qrError && (
          <p className="text-red-600 text-sm bg-red-50 rounded-xl px-4 py-3 text-center">{qrError}</p>
        )}

        {/* Botones principales */}
        {!scanning && qrStatus !== 'found' && (
          <div className="w-full max-w-xs flex flex-col gap-3">
            <button
              onClick={handleContinueAsGuest}
              className="w-full bg-brand-600 hover:bg-brand-500 active:scale-95 text-white font-bold text-lg rounded-2xl py-4 transition-all"
            >
              Continuar como invitado
            </button>
            <button
              onClick={startCamera}
              className="w-full bg-white border border-gray-300 hover:bg-gray-50 active:scale-95 text-gray-700 font-semibold text-base rounded-2xl py-4 transition-all flex items-center justify-center gap-2"
            >
              📷 Escanear tarjeta QR
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/apps/waiter/screens/CustomerScreen.tsx
git commit -m "feat(waiter): add CustomerScreen with QR scan and guest option"
```

---

## Task 9: Frontend — MenuScreen (con búsqueda)

**Files:**
- Create: `frontend/src/apps/waiter/screens/MenuScreen.tsx`

- [ ] **Step 1: Crear `MenuScreen.tsx`**

```tsx
// frontend/src/apps/waiter/screens/MenuScreen.tsx
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import waiterApi from '../lib/waiter-api';
import { useWaiterStore } from '../store/waiter.store';
import { useSettings } from '../../../hooks/useSettings';
import { formatCurrency } from '../../../stores/settings.store';

type Product = {
  id: string; name: string; price: number; taxRate?: number;
  imageUrl?: string; description?: string; categoryId: string;
  modifiers?: { id: string; required: boolean }[];
};
type Category = { id: string; name: string };

export default function MenuScreen() {
  const { user, goTo, selectProduct, addToCart, cart, customer, orderMode, existingOrderNumber, selectedTable } = useWaiterStore();
  const settings = useSettings();
  const branchId = user?.branchId ?? '';

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const isExempt = customer?.isExempt ?? false;

  const { data: menu } = useQuery({
    queryKey: ['waiter-menu', branchId],
    queryFn: () => waiterApi.get(`/waiter/${branchId}/menu`).then((r) => r.data),
    enabled: !!branchId,
    staleTime: 5 * 60_000,
  });

  const categories: Category[] = menu?.categories ?? [];
  const allProducts: Product[] = menu?.products ?? [];

  const filtered = useMemo(() => {
    let list = activeCategoryId
      ? allProducts.filter((p) => p.categoryId === activeCategoryId)
      : allProducts;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [allProducts, activeCategoryId, search]);

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce(
    (s, i) => s + i.price * (isExempt ? 1 : (1 + i.taxRate / 100)) * i.quantity, 0,
  );

  const getCartQty = (productId: string) =>
    cart.filter((c) => c.productId === productId).reduce((s, c) => s + c.quantity, 0);

  const handleProductTap = (p: Product) => {
    const hasRequired = (p.modifiers ?? []).some((m) => m.required);
    if (hasRequired) {
      selectProduct(p.id);
      return;
    }
    // Sin modificadores obligatorios: añadir directamente al carrito
    const taxRate = p.taxRate ?? 0;
    const basePrice = taxRate > 0 ? p.price / (1 + taxRate / 100) : p.price;
    addToCart({
      productId: p.id,
      productName: p.name,
      price: basePrice,
      taxRate,
      quantity: 1,
      modifiers: [],
    });
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
      {/* Sidebar + contenido */}
      <div className="flex flex-1 min-h-0">

        {/* Sidebar categorías */}
        <div className="w-24 sm:w-32 flex-shrink-0 flex flex-col bg-white border-r border-gray-200 overflow-y-auto">
          <button
            onClick={() => setActiveCategoryId(null)}
            className={`py-3 px-2 text-center text-xs font-semibold border-l-4 transition-colors ${
              !activeCategoryId
                ? 'border-brand-600 bg-brand-50 text-brand-600'
                : 'border-transparent text-gray-600 hover:bg-gray-50'
            }`}
          >
            Todos
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategoryId(c.id)}
              className={`py-3 px-2 text-center text-xs font-semibold border-l-4 transition-colors leading-tight ${
                activeCategoryId === c.id
                  ? 'border-brand-600 bg-brand-50 text-brand-600'
                  : 'border-transparent text-gray-600 hover:bg-gray-50'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Área principal */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Context banner */}
          <div className="px-3 pt-2 pb-1 bg-white border-b border-gray-100">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <button onClick={() => goTo('CUSTOMER')} className="text-gray-400 text-xl flex-shrink-0">←</button>
                <p className="text-sm font-semibold text-gray-700 truncate">
                  {selectedTable?.number ? `Mesa ${selectedTable.number}` : 'Para llevar'}
                  {orderMode === 'add' && existingOrderNumber ? ` · Orden #${existingOrderNumber}` : ''}
                  {customer ? ` · ${customer.name}` : ''}
                </p>
              </div>
            </div>
            {/* Búsqueda */}
            <div className="relative mt-2">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar producto…"
                className="w-full rounded-xl border border-gray-200 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-gray-50"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Grid de productos */}
          <div className="flex-1 overflow-y-auto p-3">
            {filtered.length === 0 ? (
              <p className="text-center text-gray-400 mt-16 text-sm">
                {search ? `Sin resultados para "${search}"` : 'Sin productos'}
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 auto-rows-max">
                {filtered.map((p) => {
                  const qty = getCartQty(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleProductTap(p)}
                      className="relative aspect-square overflow-hidden rounded-2xl bg-white border border-gray-200 hover:border-brand-400 active:scale-95 transition-all text-left group shadow-sm"
                    >
                      {p.imageUrl
                        ? <img src={p.imageUrl} alt={p.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        : <div className="absolute inset-0 flex items-center justify-center text-4xl bg-gray-100">🍽️</div>
                      }
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-6 pb-2 px-2">
                        <p className="text-xs font-semibold text-white line-clamp-2 leading-tight">{p.name}</p>
                        <p className="text-sm font-bold text-brand-400 mt-0.5">{formatCurrency(p.price, settings)}</p>
                      </div>
                      {/* Badge de cantidad en carrito */}
                      {qty > 0 && (
                        <div className="absolute top-2 right-2 bg-brand-600 text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shadow">
                          {qty}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 shadow-lg">
        {cartCount > 0 ? (
          <button
            onClick={() => goTo('CART')}
            className="w-full flex items-center justify-between bg-brand-600 hover:bg-brand-500 active:scale-95 text-white font-bold rounded-2xl px-5 py-3.5 transition-all"
          >
            <span className="flex items-center gap-2 text-base">🛒 Ver orden ({cartCount})</span>
            <span className="text-base">{formatCurrency(cartTotal, settings)}</span>
          </button>
        ) : (
          <p className="text-center text-gray-400 text-sm py-1">Agrega productos al carrito</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/apps/waiter/screens/MenuScreen.tsx
git commit -m "feat(waiter): add MenuScreen with search, quick-add and cart badge"
```

---

## Task 10: Frontend — ProductDetailScreen

**Files:**
- Create: `frontend/src/apps/waiter/screens/ProductDetailScreen.tsx`

- [ ] **Step 1: Crear `ProductDetailScreen.tsx`**

Adaptado del kiosk. Usa `waiter-api` y `waiter.store`.

```tsx
// frontend/src/apps/waiter/screens/ProductDetailScreen.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import waiterApi from '../lib/waiter-api';
import { useWaiterStore } from '../store/waiter.store';
import { useSettings } from '../../../hooks/useSettings';
import { formatCurrency } from '../../../stores/settings.store';

export default function ProductDetailScreen() {
  const { user, selectedProductId, addToCart, goTo } = useWaiterStore();
  const settings = useSettings();
  const branchId = user?.branchId ?? '';

  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string>>({});

  const { data: menu } = useQuery({
    queryKey: ['waiter-menu', branchId],
    queryFn: () => waiterApi.get(`/waiter/${branchId}/menu`).then((r) => r.data),
    enabled: !!branchId,
    staleTime: 5 * 60_000,
  });

  const product = menu?.products?.find((p: { id: string }) => p.id === selectedProductId);
  if (!product) return null;

  const modifiers: { id: string; name: string; required: boolean; options: { id: string; name: string; extraPrice: number }[] }[] =
    product.modifiers ?? [];

  const extraPrice = Object.entries(selectedModifiers).reduce((sum, [modId, optId]) => {
    const mod = modifiers.find((m) => m.id === modId);
    const opt = mod?.options.find((o: { id: string }) => o.id === optId);
    return sum + (opt?.extraPrice ?? 0);
  }, 0);

  const taxRate: number = product.taxRate ?? 0;
  const salePriceUnit = Number(product.price) + extraPrice;
  const baseUnitPrice = taxRate > 0 ? salePriceUnit / (1 + taxRate / 100) : salePriceUnit;
  const unitTotal = salePriceUnit * quantity;

  const allRequiredSelected = modifiers
    .filter((m) => m.required)
    .every((m) => selectedModifiers[m.id]);

  const handleAdd = () => {
    const modifiersList = Object.entries(selectedModifiers).map(([modId, optId]) => {
      const mod = modifiers.find((m) => m.id === modId)!;
      const opt = mod.options.find((o: { id: string }) => o.id === optId)!;
      return { modifierOptionId: optId, optionName: opt.name, extraPrice: opt.extraPrice };
    });
    addToCart({
      productId: product.id,
      productName: product.name,
      price: baseUnitPrice,
      taxRate,
      quantity,
      notes: notes.trim() || undefined,
      modifiers: modifiersList,
    });
    goTo('MENU');
  };

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
        <button onClick={() => goTo('MENU')} className="text-gray-500 text-2xl p-1">←</button>
        <h2 className="text-base font-bold text-gray-900 truncate flex-1">{product.name}</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {product.imageUrl && (
          <img src={product.imageUrl} alt={product.name} className="w-full h-48 object-cover rounded-2xl" />
        )}
        {product.description && (
          <p className="text-sm text-gray-500 leading-relaxed">{product.description}</p>
        )}

        {/* Modificadores */}
        {modifiers.map((mod) => (
          <div key={mod.id}>
            <p className="text-sm font-bold text-gray-800 mb-2">
              {mod.name} {mod.required && <span className="text-red-500">*</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              {mod.options.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSelectedModifiers((p) => ({ ...p, [mod.id]: opt.id }))}
                  className={`px-3 py-2 rounded-xl text-sm font-semibold border-2 transition-all active:scale-95 ${
                    selectedModifiers[mod.id] === opt.id
                      ? 'border-brand-600 bg-brand-50 text-brand-700'
                      : 'border-gray-200 text-gray-700'
                  }`}
                >
                  {opt.name}{opt.extraPrice > 0 ? ` +${formatCurrency(opt.extraPrice, settings)}` : ''}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Notas */}
        <div>
          <p className="text-sm font-bold text-gray-800 mb-2">Notas (opcional)</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Sin cebolla, extra picante…"
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
            rows={2}
          />
        </div>

        {/* Cantidad */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-gray-800">Cantidad</p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-10 h-10 rounded-full bg-gray-100 text-gray-700 font-bold text-xl flex items-center justify-center active:scale-95"
            >−</button>
            <span className="text-xl font-black text-gray-900 w-6 text-center">{quantity}</span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              className="w-10 h-10 rounded-full bg-brand-600 text-white font-bold text-xl flex items-center justify-center active:scale-95"
            >+</button>
          </div>
        </div>
      </div>

      {/* Botón agregar */}
      <div className="px-4 py-4 border-t border-gray-100">
        <button
          onClick={handleAdd}
          disabled={!allRequiredSelected}
          className="w-full bg-brand-600 hover:bg-brand-500 active:scale-95 disabled:opacity-40 text-white font-bold rounded-2xl py-4 text-base transition-all flex items-center justify-center gap-3"
        >
          <span>Agregar al pedido</span>
          <span className="bg-white/20 px-3 py-1 rounded-xl">{formatCurrency(unitTotal, settings)}</span>
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/apps/waiter/screens/ProductDetailScreen.tsx
git commit -m "feat(waiter): add ProductDetailScreen with modifiers and notes"
```

---

## Task 11: Frontend — CartScreen

**Files:**
- Create: `frontend/src/apps/waiter/screens/CartScreen.tsx`

- [ ] **Step 1: Crear `CartScreen.tsx`**

```tsx
// frontend/src/apps/waiter/screens/CartScreen.tsx
import { useState } from 'react';
import { useWaiterStore } from '../store/waiter.store';
import { useSettings } from '../../../hooks/useSettings';
import { formatCurrency } from '../../../stores/settings.store';

export default function CartScreen({ isPending }: { isPending: boolean }) {
  const { cart, removeFromCart, updateCartQty, goTo, customer, orderMode, existingOrderNumber } = useWaiterStore();
  const settings = useSettings();
  const isExempt = customer?.isExempt ?? false;
  const [orderNotes, setOrderNotes] = useState('');

  const total = cart.reduce(
    (s, i) => s + i.price * (isExempt ? 1 : (1 + i.taxRate / 100)) * i.quantity, 0,
  );

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
        <button onClick={() => goTo('MENU')} className="text-gray-500 text-2xl p-1">←</button>
        <div className="flex-1">
          <h2 className="text-base font-bold text-gray-900">Revisar pedido</h2>
          {orderMode === 'add' && existingOrderNumber && (
            <p className="text-xs text-brand-600">Agregando a orden #{existingOrderNumber}</p>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {cart.length === 0 && (
          <p className="text-center text-gray-400 mt-16">El carrito está vacío</p>
        )}

        {cart.map((item, idx) => {
          const lineTotal = item.price * (isExempt ? 1 : (1 + item.taxRate / 100)) * item.quantity;
          return (
            <div key={`${item.productId}-${idx}`} className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">{item.productName}</p>
                  {item.modifiers.length > 0 && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {item.modifiers.map((m) => m.optionName).join(', ')}
                    </p>
                  )}
                  {item.notes && (
                    <p className="text-xs text-gray-400 italic mt-0.5">"{item.notes}"</p>
                  )}
                </div>
                <button
                  onClick={() => removeFromCart(item.productId)}
                  className="text-gray-300 hover:text-red-400 text-xl flex-shrink-0"
                >×</button>
              </div>
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => updateCartQty(item.productId, item.quantity - 1)}
                    className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 font-bold flex items-center justify-center active:scale-95"
                  >−</button>
                  <span className="text-base font-black text-gray-900 w-5 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateCartQty(item.productId, item.quantity + 1)}
                    className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center active:scale-95"
                  >+</button>
                </div>
                <p className="text-base font-bold text-gray-900">{formatCurrency(lineTotal, settings)}</p>
              </div>
            </div>
          );
        })}

        {/* Notas de la orden */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-sm font-bold text-gray-800 mb-2">Notas para la orden</p>
          <textarea
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
            placeholder="Alérgenos, preferencias generales…"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
            rows={2}
          />
        </div>

        {/* Total */}
        <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <p className="text-base font-bold text-gray-700">Total</p>
          <p className="text-xl font-black text-brand-600">{formatCurrency(total, settings)}</p>
        </div>
      </div>

      {/* Botón enviar */}
      <div className="px-4 py-4 bg-white border-t border-gray-200">
        <button
          disabled={cart.length === 0 || isPending}
          className="w-full bg-brand-600 hover:bg-brand-500 active:scale-95 disabled:opacity-40 text-white font-bold rounded-2xl py-4 text-base transition-all"
          onClick={() => {
            // App.tsx maneja el submit con acceso a orderNotes via ref o callback
            // Disparar evento personalizado para que App.tsx lo capture
            window.dispatchEvent(new CustomEvent('waiter:submit-order', { detail: { notes: orderNotes } }));
          }}
        >
          {isPending ? 'Enviando…' : '✅ Enviar a cocina'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/apps/waiter/screens/CartScreen.tsx
git commit -m "feat(waiter): add CartScreen with qty editing and order notes"
```

---

## Task 12: Frontend — ConfirmationScreen

**Files:**
- Create: `frontend/src/apps/waiter/screens/ConfirmationScreen.tsx`

- [ ] **Step 1: Crear `ConfirmationScreen.tsx`**

```tsx
// frontend/src/apps/waiter/screens/ConfirmationScreen.tsx
import { useMutation } from '@tanstack/react-query';
import waiterApi from '../lib/waiter-api';
import { useWaiterStore } from '../store/waiter.store';

export default function ConfirmationScreen() {
  const { confirmedOrderNumber, confirmedOrderId, selectedTable, user, reset } = useWaiterStore();
  const branchId = user?.branchId ?? '';

  const requestBillMutation = useMutation({
    mutationFn: () =>
      waiterApi.patch(`/waiter/tables/${selectedTable!.id}/request-bill?branchId=${branchId}`),
    onSuccess: reset,
  });

  const canRequestBill =
    selectedTable &&
    selectedTable.id &&
    selectedTable.status !== 'bill_requested';

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-green-50 to-gray-50 px-6 gap-6">
      <span className="text-7xl">✅</span>

      <div className="text-center">
        <h1 className="text-2xl font-black text-gray-900">¡Orden enviada!</h1>
        {selectedTable?.number ? (
          <p className="text-gray-500 mt-1">Mesa {selectedTable.number}</p>
        ) : (
          <p className="text-gray-500 mt-1">Para llevar</p>
        )}
      </div>

      <div className="bg-white rounded-3xl px-10 py-5 text-center shadow-sm">
        <p className="text-gray-400 text-sm mb-1">Número de orden</p>
        <p className="text-7xl font-black text-brand-600">{confirmedOrderNumber}</p>
      </div>

      <div className="w-full max-w-xs flex flex-col gap-3 mt-2">
        <button
          onClick={reset}
          className="w-full bg-brand-600 hover:bg-brand-500 active:scale-95 text-white font-bold rounded-2xl py-4 text-base transition-all"
        >
          Nueva orden
        </button>

        {canRequestBill && (
          <button
            onClick={() => requestBillMutation.mutate()}
            disabled={requestBillMutation.isPending}
            className="w-full bg-blue-50 hover:bg-blue-100 active:scale-95 text-blue-700 font-bold rounded-2xl py-4 text-base transition-all disabled:opacity-50"
          >
            🧾 Solicitar cuenta
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/apps/waiter/screens/ConfirmationScreen.tsx
git commit -m "feat(waiter): add ConfirmationScreen without auto-reset timer"
```

---

## Task 13: Frontend — App.tsx (orquestación)

**Files:**
- Create: `frontend/src/apps/waiter/App.tsx`

- [ ] **Step 1: Crear `App.tsx`**

```tsx
// frontend/src/apps/waiter/App.tsx
import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import waiterApi from './lib/waiter-api';
import { useWaiterStore } from './store/waiter.store';
import { useSettingsLoader, useSettings } from '../../hooks/useSettings';
import LoginScreen from './screens/LoginScreen';
import TablesScreen from './screens/TablesScreen';
import CustomerScreen from './screens/CustomerScreen';
import MenuScreen from './screens/MenuScreen';
import ProductDetailScreen from './screens/ProductDetailScreen';
import CartScreen from './screens/CartScreen';
import ConfirmationScreen from './screens/ConfirmationScreen';

export default function App() {
  useSettingsLoader();
  const settings = useSettings();
  const {
    screen, user, cart, customer, selectedTable, orderMode,
    existingOrderId, orderType, setConfirmedOrder,
  } = useWaiterStore();

  const [orderNotes, setOrderNotes] = useState('');

  // Aplicar color de marca
  useEffect(() => {
    document.documentElement.style.setProperty('--brand-600', settings.brandColor ?? '#ea580c');
  }, [settings.brandColor]);

  // Escuchar el evento de submit del CartScreen
  useEffect(() => {
    const handler = (e: Event) => {
      const notes = (e as CustomEvent<{ notes: string }>).detail.notes;
      setOrderNotes(notes);
    };
    window.addEventListener('waiter:submit-order', handler);
    return () => window.removeEventListener('waiter:submit-order', handler);
  }, []);

  // Disparar mutación cuando cambia orderNotes (solo si hay ítems)
  useEffect(() => {
    if (orderNotes !== '' || cart.length > 0) {
      // solo submit si se disparó el evento (no en mount inicial)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const branchId = user?.branchId ?? '';

  const placeOrder = useMutation({
    mutationFn: (notes: string) => {
      const items = cart.map((i) => ({
        productId: i.productId,
        productName: i.productName,
        unitPrice: i.price,
        quantity: i.quantity,
        notes: i.notes,
        modifiers: i.modifiers,
      }));

      if (orderMode === 'add' && existingOrderId) {
        return waiterApi
          .post(`/waiter/orders/${existingOrderId}/items?branchId=${branchId}`, { items })
          .then((r) => r.data);
      }

      const config = { currency: 'CRC', taxPercentage: 13 }; // defaults; se usa lo que viene del menu
      return waiterApi
        .post('/waiter/orders', {
          branchId,
          type: orderType === 'TAKEOUT' ? 'takeout' : 'dine_in',
          tableId: selectedTable?.id || undefined,
          customerId: customer?.id ?? undefined,
          notes: notes || undefined,
          taxPercentage: 13,
          items,
        })
        .then((r) => r.data);
    },
    onSuccess: (data) => {
      setConfirmedOrder(String(data.orderNumber), data.id);
    },
  });

  // Manejar submit desde CartScreen
  useEffect(() => {
    const handler = (e: Event) => {
      const notes = (e as CustomEvent<{ notes: string }>).detail.notes;
      placeOrder.mutate(notes);
    };
    window.addEventListener('waiter:submit-order', handler);
    return () => window.removeEventListener('waiter:submit-order', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, orderMode, existingOrderId, orderType, selectedTable, customer, branchId]);

  const screenMap: Record<typeof screen, React.ReactNode> = {
    LOGIN: <LoginScreen />,
    TABLES: <TablesScreen />,
    CUSTOMER: <CustomerScreen />,
    MENU: <MenuScreen />,
    PRODUCT_DETAIL: <ProductDetailScreen />,
    CART: <CartScreen isPending={placeOrder.isPending} />,
    CONFIRMATION: <ConfirmationScreen />,
  };

  return (
    <div className="w-full h-full flex flex-col">
      {screenMap[screen]}
    </div>
  );
}
```

- [ ] **Step 2: Limpiar el useEffect duplicado de `orderNotes`**

En `App.tsx`, el primer `useEffect` vacío que no hace nada (líneas relacionadas con `orderNotes !== ''`) debe eliminarse, quedando solo el que registra el event listener `waiter:submit-order`. Verificar que no queden referencias muertas.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/apps/waiter/App.tsx
git commit -m "feat(waiter): add App.tsx orchestration with order submission logic"
```

---

## Task 14: Docker rebuild y verificación

**Files:** ninguno (operación de build)

- [ ] **Step 1: Rebuild completo (backend + frontend)**

```powershell
cd "c:\Proyectos\Github\Restaurante\Restaurante"
docker compose build backend frontend
docker compose up -d
```

Esperar a que los 4 contenedores estén `Healthy/Running`.

- [ ] **Step 2: Verificar backend — WaiterModule cargó**

```powershell
docker compose logs api --tail=50
```

Buscar: `WaiterModule dependencies initialized` o la ausencia de errores de TypeScript/module.

- [ ] **Step 3: Verificar frontend — URL /waiter/ responde**

Abrir en el navegador: `http://localhost/waiter/`  
Debe mostrar la pantalla `LoginScreen`.

- [ ] **Step 4: Test de flujo completo**

1. Login con usuario de rol `waiter` → debe navegar a `TABLES`
2. Tap en mesa libre → va a `CUSTOMER`
3. Continuar como invitado → va a `MENU`
4. Buscar un producto → filtra en tiempo real
5. Tap en producto → añade al carrito (badge numérico)
6. Tap "Ver orden" → va a `CART`
7. "Enviar a cocina" → va a `CONFIRMATION` con número de orden

- [ ] **Step 5: Verificar mesa ocupada**

1. Con una mesa con orden activa, tocar la mesa → aparece bottom sheet
2. "Agregar ítems" → flujo completo → en `CART` aparece el banner "Agregando a orden #X"
3. "Solicitar cuenta" → toast de confirmación, mesa cambia a estado azul

- [ ] **Step 6: Commit final**

```bash
git add -A
git commit -m "feat(waiter): complete waiter mobile app - backend module + frontend SPA"
```

---

## Resumen de archivos

| Archivo | Acción |
|---|---|
| `backend/src/orders/orders.service.ts` | Modificar — agregar `addItemsToOrder` |
| `backend/src/orders/orders.module.ts` | Verificar `exports` |
| `backend/src/tables/tables.module.ts` | Verificar `exports` |
| `backend/src/waiter/dto/add-order-items.dto.ts` | Crear |
| `backend/src/waiter/waiter.service.ts` | Crear |
| `backend/src/waiter/waiter.controller.ts` | Crear |
| `backend/src/waiter/waiter.module.ts` | Crear |
| `backend/src/app.module.ts` | Modificar — registrar `WaiterModule` |
| `frontend/vite.waiter.config.ts` | Crear |
| `frontend/package.json` | Modificar — scripts |
| `frontend/nginx.conf.template` | Modificar — location `/waiter/` |
| `frontend/Dockerfile` | Modificar — copiar dist/waiter |
| `frontend/src/apps/waiter/index.html` | Crear |
| `frontend/src/apps/waiter/index.css` | Crear |
| `frontend/src/apps/waiter/main.tsx` | Crear |
| `frontend/src/apps/waiter/lib/waiter-api.ts` | Crear |
| `frontend/src/apps/waiter/store/waiter.store.ts` | Crear |
| `frontend/src/apps/waiter/screens/LoginScreen.tsx` | Crear |
| `frontend/src/apps/waiter/screens/TablesScreen.tsx` | Crear |
| `frontend/src/apps/waiter/screens/CustomerScreen.tsx` | Crear |
| `frontend/src/apps/waiter/screens/MenuScreen.tsx` | Crear |
| `frontend/src/apps/waiter/screens/ProductDetailScreen.tsx` | Crear |
| `frontend/src/apps/waiter/screens/CartScreen.tsx` | Crear |
| `frontend/src/apps/waiter/screens/ConfirmationScreen.tsx` | Crear |
| `frontend/src/apps/waiter/App.tsx` | Crear |
