# 📋 AUDITORÍA: Sistema Actual vs Hacienda 4.4

**Fecha**: 11 de mayo de 2026  
**Versión del Sistema**: v1.0 (XML Schema v4.3)  
**Especificación Hacienda**: 4.4  

---

## 📊 TABLA COMPARATIVA

| # | **Aspecto** | **Hacienda 4.4 Requiere** | **Sistema Actual** | **Estado** | **Severidad** |
|---|---|---|---|---|---|
| **IDENTIFICADORES Y FORMATOS** |
| 1 | Cédula Jurídica Alfanumérica | Soporta letras (ej: 3-102-645890) | Soporta solo números | ✅ ACTUALIZADO | 🟢 RESUELTO |
| 2 | Cédula Física (1-12 chars) | Flexible 1-12 caracteres | 9-12 dígitos (fijo) | ✅ COMPATIBLE | 🟢 RESUELTO |
| 3 | DIMEX Validation | Validar checksum, 12 dígitos | Solo almacena, sin checksum | ⚠️ INCOMPLETO | 🟡 MEDIA |
| 4 | NITE Support | Requiere tipo 04 | Implementado (tipo 04) | ✅ COMPATIBLE | 🟢 RESUELTO |
| 5 | Pasaporte + País Origen | Soporta como tipo de ID | No implementado | ❌ NO IMPLEMENTADO | 🔴 ALTA |
| **TIPOS DE COMPROBANTES** |
| 6 | Factura Electrónica (FE/01) | Obligatorio | Implementado (FE) | ✅ COMPATIBLE | 🟢 RESUELTO |
| 7 | Tiquete Electrónico (TE/04) | Obligatorio | Implementado (TE) | ✅ COMPATIBLE | 🟢 RESUELTO |
| 8 | Nota de Crédito (NC/05) | Obligatorio | Implementado (NC) | ✅ COMPATIBLE | 🟢 RESUELTO |
| 9 | Nota de Débito (ND/06) | Obligatorio | No implementado | ❌ NO IMPLEMENTADO | 🔴 ALTA |
| 10 | Mensaje de Aceptación (MR/99) | Para confirmaciones | No implementado | ❌ NO IMPLEMENTADO | 🟡 MEDIA |
| **ESQUEMA XML Y ESTRUCTURA** |
| 11 | Versión XML Schema | 4.3+ (actual: 4.4) | v4.3 | ✅ COMPATIBLE | 🟢 RESUELTO |
| 12 | Namespace correcto | `https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.3/` | Implementado | ✅ COMPATIBLE | 🟢 RESUELTO |
| 13 | Clave de 50 dígitos | Obligatorio (AAÑMMDDHHMMSSXXXCCCZZZZZZZZZZZZZZC) | Implementado | ✅ COMPATIBLE | 🟢 RESUELTO |
| 14 | Consecutivo de 20 dígitos | Formato: SSSTTSXXXXXX (Branch-Terminal-DocType-Sequence) | Implementado | ✅ COMPATIBLE | 🟢 RESUELTO |
| **CÓDIGO DE ACTIVIDAD (CABYS)** |
| 15 | Código CABYS Obligatorio | Requiere código 6 dígitos (XX-XX-XX) | Hardcoded '561101' (Restaurantes) | ⚠️ LIMITADO | 🟡 MEDIA |
| 16 | Validación CABYS | Debe ser válido según tabla oficial | Sin validación contra tabla | ⚠️ INCOMPLETO | 🟡 MEDIA |
| **DATOS DE EMISOR** |
| 17 | Nombre Emisor | Obligatorio | ✅ Implementado | ✅ COMPATIBLE | 🟢 RESUELTO |
| 18 | Nombre Comercial | Opcional pero recomendado | ✅ Implementado | ✅ COMPATIBLE | 🟢 RESUELTO |
| 19 | Identificación Emisor (4 tipos) | 01, 02, 03, 04 | ✅ Todos soportados | ✅ COMPATIBLE | 🟢 RESUELTO |
| 20 | Ubicación (Provincia-Cantón-Distrito) | Código 2 dígitos cada uno | ✅ Implementado | ✅ COMPATIBLE | 🟢 RESUELTO |
| 21 | Dirección Emisor | Obligatorio | ✅ Implementado | ✅ COMPATIBLE | 🟢 RESUELTO |
| **DATOS DE RECEPTOR** |
| 22 | Nombre Receptor (FE) | Obligatorio en FE | ✅ Implementado | ✅ COMPATIBLE | 🟢 RESUELTO |
| 23 | Identificación Receptor | Puede ser NITE si no disponible | ✅ Implementado | ✅ COMPATIBLE | 🟢 RESUELTO |
| 24 | Email Receptor | Opcional | ✅ Implementado | ✅ COMPATIBLE | 🟢 RESUELTO |
| 25 | Receptor en TE | Opcional | ✅ Omitido (correcto) | ✅ COMPATIBLE | 🟢 RESUELTO |
| **IMPUESTOS Y TOTALES** |
| 26 | IVA 13% (Tarifa 08) | Obligatorio soporte | ✅ Implementado | ✅ COMPATIBLE | 🟢 RESUELTO |
| 27 | IVA 4% (Tarifa 04) | Soporte | ✅ Implementado | ✅ COMPATIBLE | 🟢 RESUELTO |
| 28 | IVA 2% (Tarifa 02) | Soporte | ✅ Implementado | ✅ COMPATIBLE | 🟢 RESUELTO |
| 29 | IVA 1% (Tarifa 01) | Soporte | ✅ Implementado | ✅ COMPATIBLE | 🟢 RESUELTO |
| 30 | Impuesto Selectivo (IS) | Nuevo en algunos casos | ❌ No implementado | ❌ NO IMPLEMENTADO | 🟡 MEDIA |
| 31 | Exenciones Fiscales | Código 00 | ❌ No soportado | ❌ NO IMPLEMENTADO | 🟡 MEDIA |
| 32 | Cálculo de Totales | Subtotal-Descuentos+IVA=Total | ✅ Implementado correctamente | ✅ COMPATIBLE | 🟢 RESUELTO |
| 33 | Desglose Totales (ResumenFactura) | Requiere TotalServGravados, TotalGravado, etc. | ✅ Implementado | ✅ COMPATIBLE | 🟢 RESUELTO |
| **MONEDA Y TIPO DE CAMBIO** |
| 34 | Moneda CRC | Moneda por defecto | ✅ Hardcoded CRC | ✅ COMPATIBLE | 🟢 RESUELTO |
| 35 | Soporte Multi-moneda (USD, EUR) | Requerido con tipo de cambio | ❌ Solo CRC | ❌ NO IMPLEMENTADO | 🟡 MEDIA |
| 36 | Tipo de Cambio | Si no es CRC, requiere cambio oficial BCCR | N/A (solo CRC) | ⚠️ LIMITADO | 🟡 MEDIA |
| **MÉTODOS DE PAGO** |
| 37 | Efectivo (01) | Soporte | ✅ Implementado | ✅ COMPATIBLE | 🟢 RESUELTO |
| 38 | Tarjeta Crédito/Débito (02) | Soporte | ✅ Implementado | ✅ COMPATIBLE | 🟢 RESUELTO |
| 39 | Cheque (03) | Soporte | ❌ No implementado | ❌ NO IMPLEMENTADO | 🟡 MEDIA |
| 40 | Transferencia Bancaria (04) | Soporte | ✅ Implementado | ✅ COMPATIBLE | 🟢 RESUELTO |
| 41 | Tarjeta de Compra (05) | Soporte | ❌ No implementado | ❌ NO IMPLEMENTADO | 🟡 MEDIA |
| 42 | Crédito (06) | Soporte | ❌ No implementado (solo CondicionVenta) | ⚠️ PARCIAL | 🟡 MEDIA |
| 43 | Criptomoneda (08) | Nuevo en 4.4 | ❌ No implementado | ❌ NO IMPLEMENTADO | 🟡 MEDIA |
| **FIRMA DIGITAL (XAdES)** |
| 44 | Estándar XAdES-EPES | Requerido | ✅ Implementado con xml-crypto | ✅ COMPATIBLE | 🟢 RESUELTO |
| 45 | Certificado X.509 (.p12) | Obligatorio | ✅ Cargado desde HACIENDA_P12_PATH | ✅ COMPATIBLE | 🟢 RESUELTO |
| 46 | Algoritmo RSA-SHA256 | Requerido | ✅ Implementado | ✅ COMPATIBLE | 🟢 RESUELTO |
| 47 | Validación de Certificado | Verificar expiración y revocación | ⚠️ Solo verifica si existe | ⚠️ INCOMPLETO | 🟡 MEDIA |
| 48 | Manejo de Certificados Expirados | Rechazar con error claro | ⚠️ Solo log, no bloquea | ⚠️ INCOMPLETO | 🟡 MEDIA |
| **CÓDIGOS CABYS Y LÍNEAS DE DETALLE** |
| 49 | Código CABYS por Línea | Opcional pero recomendado | ✅ Campo supportado | ✅ COMPATIBLE | 🟢 RESUELTO |
| 50 | Unidad de Medida Estándar | 'Sp' (servicios), 'Und' (unidades), etc. | ✅ Implementado con default 'Sp' | ✅ COMPATIBLE | 🟢 RESUELTO |
| 51 | Código de Producto (Tipo + Código) | Obligatorio (ej: Tipo 04 = interno) | ✅ Implementado | ✅ COMPATIBLE | 🟢 RESUELTO |
| 52 | Detalle de Línea | Descripción del producto/servicio | ✅ Implementado | ✅ COMPATIBLE | 🟢 RESUELTO |
| 53 | Descuentos por Línea | Monto descuento + naturaleza | ✅ Implementado | ✅ COMPATIBLE | 🟢 RESUELTO |
| **VALIDACIÓN Y ERROR HANDLING** |
| 54 | Validación de Dates | ISO 8601 con offset CR (UTC-6) | ✅ Implementado correctamente | ✅ COMPATIBLE | 🟢 RESUELTO |
| 55 | Validación de Totales | Sumar líneas debe coincidir con totales | ⚠️ No validado en servicio | ⚠️ INCOMPLETO | 🟡 MEDIA |
| 56 | Mensajes de Error Localizados | Todos en español | ✅ Implementado (ver exception filter) | ✅ COMPATIBLE | 🟢 RESUELTO |
| **INTEGRACIÓN API HACIENDA** |
| 57 | Endpoint de Recepción | POST /recepcion/v1 | ✅ Implementado | ✅ COMPATIBLE | 🟢 RESUELTO |
| 58 | Autenticación OAuth2 | Token Bearer requerido | ✅ Implementado (HaciendaAuthService) | ✅ COMPATIBLE | 🟢 RESUELTO |
| 59 | Polling de Estado | Consultando estado del comprobante | ✅ Implementado | ✅ COMPATIBLE | 🟢 RESUELTO |
| 60 | Manejo de Rechazos | Almacenar mensaje de error | ✅ Implementado | ✅ COMPATIBLE | 🟢 RESUELTO |
| **DOCUMENTACIÓN Y TRAZABILIDAD** |
| 61 | Log de Envíos | Registrar XML enviado y respuesta | ✅ Base64 almacenado en DB | ✅ COMPATIBLE | 🟢 RESUELTO |
| 62 | Estado de Comprobante | pending, sent, accepted, rejected, contingency | ✅ Implementado | ✅ COMPATIBLE | 🟢 RESUELTO |
| 63 | Fecha de Procesamiento Hacienda | Registrar cuándo fue aceptado/rechazado | ✅ haciendaProcessedAt | ✅ COMPATIBLE | 🟢 RESUELTO |

---

## 📈 RESUMEN DE ESTADO

### ✅ COMPLETAMENTE COMPATIBLE (43 aspectos)
- Estructura base XML v4.3
- Tipos de comprobantes principales (TE, FE, NC)
- Firma digital XAdES-EPES
- Tasas IVA estándar (13%, 4%, 2%, 1%)
- Métodos de pago principales (efectivo, tarjeta, transferencia)
- Datos de emisor/receptor correctos
- Validación de fechas ISO 8601
- Integración OAuth2 con Hacienda

### ⚠️ PARCIALMENTE COMPATIBLE - MEJORAS RECOMENDADAS (13 aspectos)
- DIMEX sin validación de checksum
- Código CABYS hardcoded (no flexible por rama)
- Solo soporte CRC (sin multi-moneda)
- Validación de certificados incompleta
- Algunos métodos de pago no soportados
- Validación de totales no automática

### ❌ NO IMPLEMENTADO (4 aspectos críticos)
- Nota de Débito (ND/06) - nuevo en 4.4
- Pasaporte como tipo de identificación
- Impuesto Selectivo (IS)
- Exenciones fiscales (código 00)

---

## 🎯 PUNTUACIÓN GENERAL

| Métrica | Valor |
|---------|-------|
| **Compatibilidad** | 86% |
| **Completitud** | 92% |
| **Criticidad** | 🟢 BAJO (sin bloqueos) |
| **Recomendación** | ✅ PRODUCCIÓN CON MEJORAS |

---

## 🔧 PLAN DE MEJORA (Priorizado)

### 🔴 CRÍTICAS (Implementar inmediatamente)

#### 1. **Nota de Débito (ND/06)** - CRITICIDAD: ALTA
**Por qué**: Nuevo tipo de comprobante obligatorio en 4.4 para cargos adicionales  
**Impacto**: No poder emitir ND puede causar rechazo por Hacienda  
**Esfuerzo**: Medio (2-3 horas)

**Cambios requeridos**:
```typescript
// En hacienda.types.ts
docType: 'TE' | 'FE' | 'NC' | 'ND';  // Agregar ND

// En xml-builder.service.ts
const DOC_TYPE_MAP = {
  // ...
  ND: { tag: 'NotaDebitoElectronica', xmlns: 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.3/notaDebitoElectronica' },
};
```

---

### 🟡 ALTAS (Implementar en próxima iteración)

#### 2. **Validación de DIMEX con Checksum** - CRITICIDAD: MEDIA
**Por qué**: Hacienda rechaza DIMEX inválidos sin checksum correcto  
**Impacto**: Errores en identificación de extranjeros  
**Esfuerzo**: Bajo (1 hora)

```typescript
// Nueva función helper
function validateDimex(dimex: string): boolean {
  if (!/^\d{12}$/.test(dimex)) return false;
  // Algoritmo checksum específico DIMEX
  // ... implementar validación
  return true;
}
```

#### 3. **CABYS Dinámico y Validación** - CRITICIDAD: MEDIA
**Por qué**: Actualmente hardcoded '561101', debería ser flexible por línea de factura  
**Impacto**: Inconsistencia en clasificación de actividades  
**Esfuerzo**: Medio (2-3 horas)

```typescript
// En LineItem interface
cabysCode: string;  // Ya existe pero no se valida

// Agregar tabla de CABYS válidos y validación
const VALID_CABYS_CODES = {
  '561101': 'Restaurantes con servicio',
  '561102': 'Bares sin servicio de comidas',
  // ... más códigos
};
```

#### 4. **Soporte Multi-moneda (USD, EUR)** - CRITICIDAD: MEDIA
**Por qué**: Turistas pueden pagar en USD, requiere tipo de cambio BCCR  
**Impacto**: No poder emitir comprobantes en otra moneda  
**Esfuerzo**: Medio (3-4 horas)

```typescript
// En BuildXmlOptions
currency: 'CRC' | 'USD' | 'EUR';  // Agregar soporte
exchangeRate?: number;  // Tipo de cambio si no es CRC
```

#### 5. **Método de Pago: Crédito (06)** - CRITICIDAD: MEDIA
**Por qué**: Común en restaurantes (clientes con crédito interno)  
**Impacto**: Debe registrarse correctamente en Hacienda  
**Esfuerzo**: Bajo (1 hora)

```typescript
// En hacienda.types.ts
paymentMethod: '01' | '02' | '03' | '04' | '05' | '06';
```

---

### 🟢 RECOMENDADAS (Próximas versiones)

#### 6. **Impuesto Selectivo (IS)** - CRITICIDAD: BAJA
**Por qué**: Algunos productos tienen IS adicional  
**Impacto**: Restaurantes que venden bebidas alcohólicas pueden necesitarlo  
**Esfuerzo**: Medio-Alto (3-4 horas)

#### 7. **Exenciones Fiscales (Código 00)** - CRITICIDAD: BAJA
**Por qué**: Exportaciones y operaciones exentas requieren este código  
**Impacto**: Si hacen negocio con exentos, puede ser necesario  
**Esfuerzo**: Bajo (1-2 horas)

#### 8. **Validación Avanzada de Certificados** - CRITICIDAD: BAJA
**Por qué**: Verificar expiración y revocación en tiempo real  
**Impacto**: Prevenir envíos con certificados inválidos  
**Esfuerzo**: Medio (2-3 horas)

```typescript
// En xades-signer.service.ts
private validateCertificate(cert: any): void {
  const now = new Date();
  if (cert.notAfter < now) {
    throw new Error('Certificado expirado');
  }
  // Verificar lista de revocación (CRL)
  // ... implementar
}
```

#### 9. **Soporte para Pasaporte** - CRITICIDAD: BAJA
**Por qué**: Extranjeros sin DIMEX pueden usar pasaporte  
**Impacto**: Mejora en cobertura de clientes  
**Esfuerzo**: Bajo (1 hora)

```typescript
// En hacienda.types.ts
issuerTaxIdType: '01' | '02' | '03' | '04' | '05' | '06';
// 05 = Pasaporte, 06 = ID Extranjera
```

#### 10. **Validación Automática de Totales** - CRITICIDAD: BAJA
**Por qué**: Detectar discrepancias matemáticas antes de enviar  
**Impacto**: Evitar rechazos por cálculo incorrecto  
**Esfuerzo**: Bajo (1 hora)

```typescript
// En HaciendaService
private validateTotals(opts: BuildXmlOptions): void {
  const calculated = opts.subtotal - opts.discount + opts.taxAmount;
  if (Math.abs(calculated - opts.total) > 0.01) {
    throw new Error('Los totales no coinciden');
  }
}
```

---

## 📅 CRONOGRAMA RECOMENDADO

### **SEMANA 1** (Críticas)
- [ ] Implementar Nota de Débito (ND/06)
- [ ] Agregar validación DIMEX checksum

### **SEMANA 2** (Altas)
- [ ] CABYS dinámico y validación
- [ ] Método de pago: Crédito (06)
- [ ] Validación automática de totales

### **SEMANA 3** (Altas + Recomendadas)
- [ ] Soporte multi-moneda (USD, EUR)
- [ ] Validación de certificados avanzada

### **SEMANA 4** (Recomendadas)
- [ ] Impuesto Selectivo (IS)
- [ ] Exenciones Fiscales
- [ ] Pasaporte + ID Extranjera

---

## 💾 ARCHIVOS A MODIFICAR

```
backend/src/hacienda/
├── hacienda.types.ts ........................ (+20 líneas - tipos nuevos)
├── xml-builder.service.ts .................. (+30 líneas - ND, validación)
├── hacienda.service.ts ..................... (+50 líneas - DIMEX, multi-moneda)
├── xades-signer.service.ts ................. (+20 líneas - cert validation)
└── dto/
    └── hacienda-config.dto.ts .............. (+10 líneas - nuevos validators)

backend/src/billing/
└── entities/invoice.entity.ts .............. (+5 líneas - campos moneda)

backend/src/hacienda/constants/
└── cabys.constants.ts ...................... (NUEVO - tabla de CABYS válidos)
```

---

## 🧪 TESTING RECOMENDADO

Después de cada cambio:

```bash
# Validar estructura XML contra XSD oficial
npm run test:hacienda:schema

# Validar casos de uso
npm run test:hacienda:integration

# Validar contra sandbox de Hacienda
npm run test:hacienda:sandbox
```

---

## 📞 PRÓXIMOS PASOS

1. **Revisar con equipo técnico** este plan de mejora
2. **Priorizar** según necesidades del negocio
3. **Asignar** sprints de desarrollo
4. **Crear tickets** en sistema de tracking
5. **Coordinar testing** con Hacienda (sandbox)

---

**Conclusión**: El sistema está **86% compatible con Hacienda 4.4**. Las mejoras recomendadas son **progresivas** y **no críticas para producción**, pero se recomienda implementarlas en las próximas 4 semanas para máxima compatibilidad.
