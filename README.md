# 🍽️ RestaurantOS — Sistema de Administración de Restaurante

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Stack](https://img.shields.io/badge/stack-NestJS%20%2B%20React%20%2B%20PostgreSQL-orange)

Sistema profesional de administración de restaurante con soporte multi-sucursal, Kiosko de autopedido, Panel de cocina en tiempo real, módulo POS completo y **facturación electrónica directa con el Ministerio de Hacienda de Costa Rica**.

---

## 📋 Tabla de Contenidos

- [Características](#características)
- [Arquitectura](#arquitectura)
- [Stack Tecnológico](#stack-tecnológico)
- [Módulos del Sistema](#módulos-del-sistema)
- [Seguridad](#seguridad)
- [Base de Datos](#base-de-datos)
- [Instalación](#instalación)
- [Variables de Entorno](#variables-de-entorno)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Roles y Permisos](#roles-y-permisos)
- [API Endpoints](#api-endpoints)
- [Facturación Electrónica Hacienda CR](#facturación-electrónica-hacienda-cr)
- [Contribuir](#contribuir)

---

## ✨ Características

- 🏢 **Multi-sucursal**: Administración centralizada con operación independiente por sucursal
- 🖥️ **Kiosko de autopedido**: Pantalla táctil estilo McDonald's, sin login, flujo ≤ 5 pasos
- 👨‍🍳 **Kitchen Display System (KDS)**: Comandas en tiempo real para cocina
- 💰 **POS completo**: Caja, facturación, métodos de pago múltiples
- 📦 **Inventario**: Control de stock, consumo automático, alertas de reposición
- 📊 **Reportes**: Ventas, costos, rendimiento, horas pico
- 👥 **CRM**: Clientes, historial, programa de fidelización
- 🔒 **Auditoría**: Log de todas las acciones críticas del sistema
- 🌐 **Multi-idioma**: Español, Inglés, Portugués (Kiosko)
- ⚡ **Tiempo real**: WebSockets para cocina y comandas
- 🧾 **Facturación electrónica Hacienda CR**: Tiquetes y facturas firmadas digitalmente (XAdES-BES), envío automático a la API de Hacienda, gestión de certificado .p12 desde la UI

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENTES                            │
│  Admin Panel │  POS (Caja)  │  KDS (Cocina)  │  Kiosko │
│  React + Vite + TypeScript + Tailwind CSS               │
└──────────────────────┬──────────────────────────────────┘
                       │ REST API + WebSockets
┌──────────────────────▼──────────────────────────────────┐
│              BACKEND  (NestJS + TypeScript)              │
│  Auth │ Sucursales │ Menú │ Órdenes │ POS │ Inventario  │
│  Facturación │ Hacienda CR │ Reportes │ CRM │ Auditoría   │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│           BASE DE DATOS  (PostgreSQL)                    │
│     Datos principales + Tiempo real (Socket.io)         │
└─────────────────────────────────────────────────────────┘
```

### Pantallas del sistema

| Pantalla | Usuario | Descripción |
|----------|---------|-------------|
| `/admin` | Admin / Branch Admin | Panel de administración general |
| `/pos` | Cajero | Punto de venta y facturación |
| `/kitchen` | Chef | Comandas en tiempo real |
| `/kiosk` | Público | Autopedido táctil (sin login) |
| `/reports` | Admin / Contador | Reportes y analytics |
| `/waiter` | Mesero | App móvil de mesero |

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología | Razón |
|------|-----------|-------|
| **Backend** | Node.js + NestJS + TypeScript | Escalable, tipado, excelente para APIs |
| **Frontend** | React + Vite + TypeScript | Rápido, ideal para pantallas táctiles |
| **UI** | Tailwind CSS + shadcn/ui | Diseño limpio y responsivo |
| **Base de Datos** | PostgreSQL + TypeORM | Confiable, ideal para datos financieros |
| **Tiempo real** | Socket.io (WebSockets) | Comandas y cocina en tiempo real |
| **Auth** | JWT + Passport.js | Seguro, con refresh tokens |
| **Cache** | Redis | Sesiones, rate limiting |
| **Contenedores** | Docker + Docker Compose | Entorno reproducible |
| **Hosting Backend** | Railway / Render / Fly.io | Económico (~$15–25/mes) |
| **Hosting Frontend** | Vercel / Netlify | CDN global gratuito |
| **Hosting DB** | Supabase / Railway / RDS | Managed PostgreSQL |

---

## 📦 Módulos del Sistema

### 3.1 Autenticación y Usuarios
- Login por rol con JWT + refresh tokens (httpOnly cookies)
- Roles: `super_admin`, `branch_admin`, `cashier`, `waiter`, `chef`, `accountant`
- Permisos granulares por módulo y sucursal
- Historial de accesos y sesiones activas

### 3.2 Configuración General (por sucursal)
- Datos del restaurante / sucursal
- Impuestos (IVA, propina, servicios) configurables
- Horarios de atención
- Moneda e idioma
- Numeración de facturas
- Configuración de impresoras

### 3.3 Productos & Menú
- Categorías con imagen y orden personalizable
- Productos con: precio, imagen, descripción, alérgenos
- Modificadores dinámicos: extras, opciones, eliminables
- Productos activables/desactivables por sucursal
- Menú digital sincronizado con Kiosko en tiempo real

### 3.4 Comandas / Cocina (KDS)
- Recepción de pedidos en tiempo real vía WebSockets
- Vista por: mesa, pedido, prioridad
- Estados: `Pendiente → En preparación → Listo → Entregado`
- Tiempo de preparación con alertas
- Notificación automática al mesero cuando el pedido está listo
- Pantalla grande optimizada para cocina

### 3.5 POS / Caja
- Creación de pedidos con búsqueda rápida
- Asignación de mesa o pedido para llevar
- División de cuenta
- Descuentos (porcentaje / monto fijo)
- Impuestos automáticos por configuración
- Métodos de pago: efectivo, tarjeta, transferencia, QR
- Apertura y cierre de turno
- Arqueo de caja

### 3.6 Facturación
- Tickets simples con impresora térmica
- Facturas con datos fiscales del cliente
- Historial completo de facturas
- Anulación y notas de crédito
- Exportar a PDF
- Integración nativa con Hacienda CR (ver sección 3.14)

### 3.14 Facturación Electrónica — Hacienda CR

> Integración directa con el Ministerio de Hacienda de Costa Rica. Sin intermediarios ni costos de SaaS.

**Tipos de comprobantes soportados:**
- `TE` Tiquete Electrónico (consumidor final, sin cédula)
- `FE` Factura Electrónica (receptor con identificación fiscal)
- `NC` Nota de Crédito Electrónica

**Flujo automático:**
```
Factura creada → XML v4.3 generado → Firmado (XAdES-BES) → Enviado a Hacienda → Polling de respuesta (hasta 5 reintentos) → Estado actualizado en DB
```

**Características técnicas:**
- Clave numérica de 50 dígitos generada automáticamente (506 + fecha + cédula + consecutivo + situación + seguridad)
- Consecutivo de 20 dígitos (sucursal + terminal + tipo + secuencia)
- Firma digital XAdES-BES con RSA-SHA256 usando certificado `.p12` del BCCR
- Token OAuth2 hacia el IDP de Hacienda con caché automático y renovación antes de expirar
- Modo contingencia: si el `.p12` no está cargado, el sistema sigue operando (sin firma) y registra estado `contingency`
- Envío no bloqueante: la factura se crea instantáneamente; Hacienda se llama en background (`setImmediate`)
- Polling exponencial: 10s → 20s → 30s → 40s → 60s máximo

**Panel de administración (sin tocar código):**

| Tab | Contenido |
|-----|-----------|
| **Emisor** | Cédula jurídica/física, tipo, provincia/cantón/distrito, códigos de sucursal y terminal |
| **Credenciales ATV** | Usuario y contraseña ATV, toggle sandbox ↔ producción (auto-completa URLs oficiales) |
| **Certificado Digital** | Upload `.p12` drag-and-drop, contraseña del certificado, indicador de estado |
| **Estado de comprobantes** | Tabla en tiempo real de las últimas 50 facturas enviadas, botón "Reenviar" para errores/rechazos |

**Ambientes preconfigurados:**

| Ambiente | IDP URL | API URL |
|----------|---------|----------|
| Sandbox | `idp.comprobanteselectronicos.go.cr/…/rut-stag/…` | `api-sandbox.comprobanteselectronicos.go.cr/recepcion/v1` |
| Producción | `idp.comprobanteselectronicos.go.cr/…/rut/…` | `api.comprobanteselectronicos.go.cr/recepcion/v1` |

### 3.7 Kiosko de Autopedido
**Flujo (≤ 5 pasos):**
```
Bienvenida → [Idioma] → Tipo de pedido → Menú → Detalle → Carrito → Pago → Confirmación
```
**Principios UX:**
- Botones grandes (dedos, no mouse)
- Pocas decisiones por pantalla
- Sin necesidad de login
- Multilenguaje (ES / EN / PT)
- Reinicio automático por inactividad (10–15 seg)
- Máximo 6 opciones visibles al mismo tiempo
- Modo kiosko del navegador (Chrome Kiosk / Electron)

### 3.8 Mesas & Servicio
- Mapa visual de mesas con drag-and-drop
- Estados: `Libre | Ocupada | Esperando comida | Cuenta pedida`
- Asignación de meseros por mesa
- Tiempo promedio por mesa
- Reservaciones

### 3.9 Inventario
- Ingredientes con unidades de medida
- Stock mínimo con alertas de reposición
- Consumo automático al cerrar una venta
- Registro de entradas y salidas manuales
- Gestión de proveedores

### 3.10 Cuentas & Gastos
- Registro de gastos: alquiler, proveedores, servicios
- Categorías contables personalizables
- Flujo de caja diario/mensual
- Vinculación con ventas para P&G

### 3.11 Reportes & Analytics
- Ventas diarias, semanales, mensuales
- Productos más vendidos
- Horas pico (heatmap)
- Rendimiento de meseros
- Costos vs ingresos y margen de ganancia
- Filtros por sucursal y rango de fechas
- Exportación a CSV / PDF

### 3.12 CRM — Clientes
- Registro de clientes con historial de compras
- Programa de puntos / fidelización
- Descuentos personalizados
- Envío de promociones

### 3.13 Auditoría & Logs
- Registro inmutable de acciones críticas
- Cambios de precios, cancelaciones, anulaciones
- Login/logout de usuarios
- Cambios de configuración
- Retención configurable (90 días / 1 año)

---

## 🔒 Seguridad

### Arquitectura de Seguridad

```
┌─────────────────────────────────────────┐
│  1. Autenticación  │  JWT (15min) +      │
│                    │  Refresh (7d, DB)   │
├─────────────────────────────────────────┤
│  2. Autorización   │  RBAC por rol +     │
│                    │  scope de sucursal  │
├─────────────────────────────────────────┤
│  3. Datos          │  Aislamiento por    │
│                    │  branch_id en DB    │
├─────────────────────────────────────────┤
│  4. Transporte     │  HTTPS + HSTS       │
├─────────────────────────────────────────┤
│  5. Aplicación     │  Helmet, CORS,      │
│                    │  Rate limiting      │
├─────────────────────────────────────────┤
│  6. Datos entrada  │  class-validator +  │
│                    │  sanitización       │
├─────────────────────────────────────────┤
│  7. Base de datos  │  TypeORM params +   │
│                    │  sin queries raw    │
├─────────────────────────────────────────┤
│  8. Kiosko         │  URL separada +     │
│                    │  modo kiosko +      │
│                    │  sin acceso admin   │
└─────────────────────────────────────────┘
```

### Roles y Acceso a Módulos

| Módulo | super_admin | branch_admin | cashier | waiter | chef | accountant |
|--------|:-----------:|:------------:|:-------:|:------:|:----:|:----------:|
| Configuración | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Usuarios | ✅ | ✅ (su sucursal) | ❌ | ❌ | ❌ | ❌ |
| Menú | ✅ | ✅ | 👁️ | 👁️ | 👁️ | ❌ |
| Órdenes | ✅ | ✅ | ✅ | ✅ (sus mesas) | 👁️ | 👁️ |
| Cocina (KDS) | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| POS / Caja | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Facturación | ✅ | ✅ | ✅ | ❌ | ❌ | 👁️ |
| Hacienda CR | ✅ | ✅ | ❌ | ❌ | ❌ | 👁️ |
| Inventario | ✅ | ✅ | ❌ | ❌ | 👁️ | 👁️ |
| Gastos | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Reportes | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| CRM | ✅ | ✅ | ✅ | ❌ | ❌ | 👁️ |
| Auditoría | ✅ | 👁️ | ❌ | ❌ | ❌ | ❌ |
| Sucursales | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

> ✅ = Acceso completo | 👁️ = Solo lectura | ❌ = Sin acceso

### Multi-sucursal y Aislamiento de Datos

Todos los registros operativos llevan `branch_id`. El sistema garantiza que:
- Un usuario sólo puede acceder a datos de su sucursal asignada
- `super_admin` puede ver y gestionar todas las sucursales
- `branch_admin` sólo ve su propia sucursal
- Las consultas filtran automáticamente por `branch_id` via guards de NestJS

---

## 🗄️ Base de Datos

### Diagrama Entidad-Relación (Simplificado)

```
branches ──< users
branches ──< categories ──< products ──< product_modifiers ──< modifier_options
branches ──< tables
branches ──< orders ──< order_items ──< order_item_modifiers
orders ──── invoices
branches ──< inventory_items ──< inventory_transactions
branches ──< expenses
branches ──< audit_logs
customers ──< orders
```

### Tablas Principales

| Tabla | Descripción |
|-------|-------------|
| `branches` | Sucursales del restaurante |
| `users` | Usuarios del sistema con rol y sucursal |
| `refresh_tokens` | Tokens de refresco para sesiones |
| `categories` | Categorías del menú por sucursal |
| `products` | Productos/platos del menú |
| `product_modifiers` | Grupos de modificadores (ej: "Término") |
| `modifier_options` | Opciones de modificadores (ej: "Bien cocido") |
| `tables` | Mesas de la sucursal |
| `orders` | Órdenes (mesa, para llevar, kiosko) |
| `order_items` | Ítems de cada orden |
| `order_item_modifiers` | Modificadores aplicados a cada ítem |
| `invoices` | Facturas generadas (incluye campos de Hacienda: clave, XML, estado) |
| `inventory_items` | Ingredientes/insumos |
| `inventory_transactions` | Movimientos de inventario |
| `suppliers` | Proveedores |
| `expenses` | Gastos del restaurante |
| `expense_categories` | Categorías de gastos |
| `customers` | Clientes del CRM |
| `loyalty_transactions` | Movimientos de puntos de fidelización |
| `audit_logs` | Log de auditoría inmutable |
| `branch_config` | Configuración por sucursal (incluye todos los campos de Hacienda CR) |
| `printer_config` | Configuración de impresoras |

---

## 🚀 Instalación

### Prerrequisitos

- Node.js >= 20
- PostgreSQL >= 15
- Redis >= 7
- Docker y Docker Compose (recomendado)

### Con Docker (Recomendado)

```bash
# Clonar el repositorio
git clone https://github.com/cmuillo/Restaurante.git
cd Restaurante

# Copiar variables de entorno
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Levantar todos los servicios
docker compose up -d

# La app estará disponible en:
# Admin/POS/KDS → http://localhost:5173
# Kiosko        → http://localhost:5174
# API           → http://localhost:3000
# API Docs      → http://localhost:3000/api/docs
```

### Instalación Manual

```bash
# --- Backend ---
cd backend
npm install
npm run migration:run   # ejecutar migraciones
npm run seed            # datos iniciales
npm run start:dev

# --- Frontend ---
cd frontend
npm install
npm run dev
```

---

## ⚙️ Variables de Entorno

### Backend (`backend/.env`)

```env
# Servidor
PORT=3000
NODE_ENV=development

# Base de datos
DATABASE_URL=postgresql://user:password@localhost:5432/restauranteos

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=tu_secret_muy_seguro_aqui
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=tu_refresh_secret
JWT_REFRESH_EXPIRES_IN=7d

# CORS
FRONTEND_URL=http://localhost:5173
KIOSK_URL=http://localhost:5174

# Email (opcional)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=no-reply@turestaurante.com
SMTP_PASS=tu_password

# ─── Hacienda CR — Facturación Electrónica (opcional, configurable desde la UI) ───
# Si se configuran aquí, sirven como fallback cuando la sucursal no tiene config en DB.
# La configuración definitiva se hace desde Admin → Hacienda.
HACIENDA_IDP_URL=https://idp.comprobanteselectronicos.go.cr/auth/realms/rut-stag/protocol/openid-connect/token
HACIENDA_API_URL=https://api-sandbox.comprobanteselectronicos.go.cr/recepcion/v1
HACIENDA_CLIENT_ID=api-stag
HACIENDA_USERNAME=tu_usuario_atv
HACIENDA_PASSWORD=tu_password_atv
HACIENDA_ISSUER_TAX_ID=3101234567
HACIENDA_ISSUER_TAX_ID_TYPE=02
HACIENDA_BRANCH_CODE=001
HACIENDA_TERMINAL_CODE=00001
HACIENDA_PROVINCE=01
HACIENDA_CANTON=01
HACIENDA_DISTRICT=01
HACIENDA_P12_PATH=/ruta/al/certificado.p12
HACIENDA_P12_PASSWORD=password_del_certificado
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
VITE_APP_NAME=RestaurantOS
```

---

## 📁 Estructura del Proyecto

```
restauranteos/
├── backend/                        # API NestJS
│   ├── src/
│   │   ├── auth/                   # JWT, guards, estrategias
│   │   ├── branches/               # Gestión de sucursales
│   │   ├── users/                  # Gestión de usuarios
│   │   ├── config/                 # Configuración por sucursal
│   │   ├── menu/                   # Categorías y productos
│   │   ├── modifiers/              # Modificadores y opciones
│   │   ├── tables/                 # Mesas y estados
│   │   ├── orders/                 # Órdenes (POS, Mesero, Kiosko)
│   │   ├── kitchen/                # KDS y comandas
│   │   ├── pos/                    # Punto de venta, caja
│   │   ├── billing/                # Facturación y tickets
│   │   ├── hacienda/               # Facturación electrónica Hacienda CR
│   │   │   ├── hacienda.controller.ts   # Endpoints config/certificado/estado
│   │   │   ├── hacienda.service.ts      # Lógica de envío y polling
│   │   │   ├── hacienda-auth.service.ts # Token OAuth2 Hacienda
│   │   │   ├── xml-builder.service.ts  # Generación XML v4.3
│   │   │   ├── xades-signer.service.ts # Firma XAdES-BES (.p12)
│   │   │   ├── hacienda.types.ts       # Interfaces TypeScript
│   │   │   └── dto/                    # hacienda-config.dto.ts
│   │   ├── inventory/              # Inventario e insumos
│   │   ├── expenses/               # Gastos y contabilidad
│   │   ├── reports/                # Reportes y analytics
│   │   ├── customers/              # CRM
│   │   ├── kiosk/                  # API del Kiosko
│   │   ├── audit/                  # Logs de auditoría
│   │   ├── websockets/             # Gateway de WebSockets
│   │   ├── database/               # Entidades, migraciones, seeds
│   │   └── common/                 # Guards, decorators, filtros
│   ├── Dockerfile
│   └── package.json
│
├── frontend/                       # React + Vite
│   ├── src/
│   │   ├── apps/
│   │   │   ├── admin/              # Panel de administración
│   │   │   │   └── pages/
│   │   │   │       └── HaciendaConfigPage.tsx  # Config Hacienda (4 tabs)
│   │   │   ├── pos/                # Pantalla de caja
│   │   │   ├── kitchen/            # Display de cocina
│   │   │   └── kiosk/              # Kiosko de autopedido
│   │   ├── components/             # Componentes compartidos
│   │   ├── hooks/                  # Custom hooks
│   │   ├── store/                  # Zustand store
│   │   ├── services/               # Clientes de API
│   │   ├── types/                  # TypeScript types
│   │   └── utils/                  # Utilidades
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml              # Orquestación local
├── docker-compose.prod.yml         # Producción
└── README.md
```

---

## 🔌 API Endpoints (Resumen)

```
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout

GET    /api/branches
POST   /api/branches

GET    /api/menu/categories
GET    /api/menu/products

POST   /api/orders
GET    /api/orders/:id
PATCH  /api/orders/:id/status

GET    /api/kitchen/pending
WS     /kitchen  (WebSocket)

POST   /api/pos/transaction
GET    /api/pos/shift

GET    /api/billing/invoices
POST   /api/billing/invoices/:id/cancel
POST   /api/billing/invoices/:id/resend-hacienda

GET    /api/hacienda/config?branchId=
PUT    /api/hacienda/config?branchId=
POST   /api/hacienda/certificate?branchId=
GET    /api/hacienda/status?branchId=&limit=50
POST   /api/hacienda/invoices/:id/resend

GET    /api/inventory/items
PATCH  /api/inventory/items/:id

GET    /api/reports/sales
GET    /api/reports/products

GET    /api/kiosk/menu          # Sin autenticación
POST   /api/kiosk/orders        # Sin autenticación

GET    /api/audit/logs
```

> Documentación completa en `/api/docs` (Swagger) al levantar el backend.

---

---

## 🧾 Facturación Electrónica Hacienda CR

### Primeros pasos

1. Obtener credenciales ATV en el [portal de Hacienda](https://www.hacienda.go.cr/)
2. Obtener el certificado de Firma Digital del BCCR (archivo `.p12`)
3. En el panel de Admin → **Hacienda**, seleccionar la sucursal y:
   - Tab **Emisor**: ingresar cédula, tipo y ubicación
   - Tab **Credenciales ATV**: usuario, contraseña y activar **Sandbox** para pruebas
   - Tab **Certificado Digital**: subir el `.p12` e ingresar su contraseña
4. Crear una factura de prueba desde el POS y verificar el estado en tab **Estado de comprobantes**
5. Cuando todo esté validado, cambiar a **Producción** en el tab de credenciales

### Estados de un comprobante

| Estado | Descripción |
|--------|-------------|
| `pending` | En cola, aún no procesado |
| `sending` | Enviándose a Hacienda |
| `sent` | Recibido por Hacienda, esperando confirmación |
| `accepted` | ✅ Aceptado por Hacienda |
| `rejected` | ❌ Rechazado (usar botón Reenviar tras corregir) |
| `error` | Error de red o configuración |
| `contingency` | Sin firma digital (modo offline) |

### Seguridad de los certificados

- Los archivos `.p12` se almacenan en `backend/certs/` (fuera del árbol fuente)
- Las carpetas `certs/`, `*.p12` y `*.pfx` están excluidas del control de versiones
- Las contraseñas se almacenan en la base de datos; en producción se recomienda usar un gestor de secretos (AWS Secrets Manager, Vault, etc.)
- Los passwords nunca se devuelven en texto plano por la API (se muestran como `••••••••`)

---

## 🤝 Contribuir

1. Fork el repositorio
2. Crea tu feature branch: `git checkout -b feature/nueva-funcionalidad`
3. Commit tus cambios: `git commit -m 'feat: agregar nueva funcionalidad'`
4. Push a tu branch: `git push origin feature/nueva-funcionalidad`
5. Abre un Pull Request

### Convenciones de commits (Conventional Commits)

```
feat:     nueva funcionalidad
fix:      corrección de bug
docs:     documentación
style:    formato, sin cambio de lógica
refactor: refactorización
test:     agregar tests
chore:    tareas de mantenimiento
```

---

## 📄 Licencia

MIT © 2025 RestaurantOS
