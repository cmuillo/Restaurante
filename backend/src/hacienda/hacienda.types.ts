/**
 * Tipos del esquema XML v4.3 de Comprobantes Electrónicos — Hacienda CR
 * Basado en: https://www.hacienda.go.cr/ATV/ComprobanteElectronico/docs/
 */

export interface LineItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;      // porcentaje, ej: 13
  discount?: number;    // monto descuento (no porcentaje)
  unitOfMeasure?: string; // 'Sp' para servicios, 'Und' para unidades
}

export interface BuildXmlOptions {
  /** TE = Tiquete Electrónico | FE = Factura Electrónica | NC = Nota de Crédito */
  docType: 'TE' | 'FE' | 'NC';
  key: string;               // Clave numérica 50 dígitos
  consecutive: string;       // Número consecutivo 20 dígitos
  date: Date;

  // Emisor (el restaurante)
  issuerName: string;
  issuerTaxId: string;       // Cédula jurídica o física (sin guiones)
  issuerTaxIdType: '01' | '02' | '03' | '04'; // 01=física 02=jurídica 03=DIMEX 04=NITE
  issuerCommercialName?: string;
  issuerProvince: string;    // código 2 dígitos
  issuerCanton: string;      // código 2 dígitos
  issuerDistrict: string;    // código 2 dígitos
  issuerAddress: string;

  // Receptor (el cliente) — opcional en TE
  receiverName?: string;
  receiverTaxId?: string;
  receiverTaxIdType?: '01' | '02' | '03' | '04';
  receiverEmail?: string;

  // Líneas
  lines: LineItem[];

  // Totales
  subtotal: number;
  discount: number;
  taxAmount: number;
  total: number;

  // Condición de venta
  saleCondition?: '01' | '02';  // 01=contado 02=crédito
  paymentMethod: '01' | '02' | '04' | '05'; // 01=efectivo 02=tarjeta 04=transfer 05=otro
}
