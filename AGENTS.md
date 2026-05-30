# Guía para Agentes y Contribuidores — RestauranteOS

Este documento orienta a agentes de IA y a personas que modifican el código.
Resume convenciones críticas (especialmente de seguridad y facturación) que
deben respetarse para no introducir regresiones fiscales o de seguridad.

## Estructura

- `backend/` — API NestJS + TypeORM (PostgreSQL). Módulos por dominio en
  `backend/src/<dominio>` (orders, billing, hacienda, credit-notes, debit-notes,
  menu, kiosk, pos, etc.).
- `frontend/` — 5 SPAs Vite (admin, pos, kitchen, waiter, kiosk).
- `HACIENDA_4.4_AUDIT.md` — auditoría funcional y de seguridad vigente.

## Comandos (backend)

```bash
cd backend
npm install
npm run build      # nest build (compila TypeScript; úsalo para validar cambios)
npm run lint       # eslint --fix
npm test           # jest (actualmente sin suites)
```

> No hay pruebas automatizadas todavía: valida siempre con `npm run build`.

## Reglas críticas de seguridad y cálculo

1. **Precios autoritativos en el servidor.** Nunca confíes en `unitPrice`,
   `extraPrice` ni nombres enviados por el cliente. Tómalos de la BD
   (`Product.price`, `ModifierOption.extraPrice`, `Product.name`,
   `ModifierOption.name`). El endpoint de kiosko es público y sin autenticación.
2. **La propina es seguimiento interno.** No se suma al `total` que paga el
   cliente. `OrdersService.create`, `addItemsToOrder` y `BillingService` deben
   calcular `total = subtotal + impuesto − descuento` y guardar `tipAmount`
   aparte. No reintroduzcas la propina en el total.
3. **Notas de crédito sin sobre-acreditar.** Antes de emitir una NC, suma las NC
   vigentes (no anuladas) de la misma factura y valida que el acumulado no
   supere `invoice.total`.
4. **Fechas de Hacienda en hora de Costa Rica (UTC-6).** `FechaEmision` y la
   fecha (ddmmyy) de la clave de 50 dígitos se calculan desde el instante UTC
   desplazado a UTC-6, no desde la hora local del servidor. Deben coincidir
   entre sí.
5. **Aislamiento por sucursal.** Filtra y valida `branchId` en consultas y
   operaciones; no expongas datos de otras sucursales.
6. **No registres secretos.** Contraseñas, `.p12`, tokens y credenciales de
   Hacienda no se loguean ni se devuelven en claro (enmascarar con `••••`).

## Convenciones de facturación / Hacienda

- Tipos de comprobante: `TE`, `FE`, `NC`, `ND` (ver `xml-builder.service.ts`).
- Construcción de XML sin firmar en `XmlBuilderService`; firma XAdES en
  `XadesSignerService`; envío y polling en `HaciendaService`.
- Valida totales con `helpers/totals-validator.ts` antes de enviar.
- Mensajes de error orientados al usuario en español.

## Pendientes conocidos (ver `HACIENDA_4.4_AUDIT.md`)

- Consecutivos bajo concurrencia (bloqueo/secuencias).
- Prorrateo de exoneraciones y descuentos a nivel de línea.
- Envío de NC/ND a Hacienda (XML + firma) y soporte de `ND` en
  `buildConsecutive`.

Al corregir cualquiera de estos, actualiza `HACIENDA_4.4_AUDIT.md` y, si cambia
una convención, también este archivo.
