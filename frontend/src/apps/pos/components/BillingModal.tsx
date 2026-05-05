import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '../../../lib/api';

interface BillingModalProps {
  isOpen: boolean;
  order: {
    id: string;
    orderNumber: number;
    subtotal: number;
    taxAmount: number;
    tipAmount: number;
    discountAmount: number;
    total: number;
    items: {
      id: string;
      productName: string;
      quantity: number;
      subtotal?: number;
    }[];
  } | null;
  onClose: () => void;
}

export type PaymentMethod = 'cash' | 'card' | 'qr' | 'mixed';

interface PrintableInvoiceItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes?: string;
  unitOfMeasure?: string;
  cabysCode?: string;
}

interface PrintableInvoiceData {
  issuer?: {
    name?: string;
    taxIdType?: string;
    taxId?: string;
    address?: string;
    phone?: string;
    email?: string;
    province?: string;
    canton?: string;
    district?: string;
  };
  invoice?: {
    invoiceNumber?: string;
    issuedAt?: string;
    paymentMethod?: string;
    haciendaKey?: string;
    haciendaConsecutive?: string;
  };
  order?: {
    orderNumber?: number;
    type?: string;
    table?: string | null;
    notes?: string;
  };
  items?: PrintableInvoiceItem[];
  totals?: {
    subtotal?: number;
    taxAmount?: number;
    tipAmount?: number;
    discountAmount?: number;
    total?: number;
    cashReceived?: number;
    change?: number;
  };
}

function toAmount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toAmount(value));
}

function formatDateTime(value?: string): string {
  if (!value) return new Date().toLocaleString('es-CR');
  return new Date(value).toLocaleString('es-CR');
}

function paymentMethodLabel(value?: string): string {
  if (value === 'cash') return 'Efectivo';
  if (value === 'card') return 'Tarjeta';
  if (value === 'qr') return 'QR';
  if (value === 'mixed') return 'Mixto';
  return 'No indicado';
}

export function BillingModal({ isOpen, order, onClose }: BillingModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [invoice, setInvoice] = useState<any>(null);
  const [step, setStep] = useState<'payment' | 'invoice'>('payment');

  useEffect(() => {
    if (!isOpen || !order) return;
    setPaymentMethod('cash');
    setCashReceived(toAmount(order.total));
    setInvoice(null);
    setStep('payment');
  }, [isOpen, order]);

  const createInvoice = useMutation({
    mutationFn: () =>
      api
        .post('/billing/invoices', {
          orderId: order?.id,
          paymentMethod,
          cashReceived: paymentMethod === 'cash' ? cashReceived : toAmount(order?.total),
        })
        .then((r) => r.data),
    onSuccess: (data) => {
      setInvoice(data);
      setStep('invoice');
    },
  });

  if (!isOpen || !order) return null;

  const subtotal = toAmount(order.subtotal);
  const taxAmount = toAmount(order.taxAmount);
  const tipAmount = toAmount(order.tipAmount);
  const discountAmount = toAmount(order.discountAmount);
  const total = toAmount(order.total);
  const change = paymentMethod === 'cash' ? Math.max(0, cashReceived - total) : 0;

  const printInvoiceReport = () => {
    const printable = (invoice?.printable || {}) as PrintableInvoiceData;
    const printableItems = (printable.items || []).filter((item) => item.quantity > 0);
    const computedItems = printableItems.length > 0
      ? printableItems
      : (order.items || []).map((item) => {
        const lineSubtotal = toAmount(item.subtotal);
        const rate = subtotal > 0 ? (taxAmount / subtotal) * 100 : 0;
        const lineTaxAmount = lineSubtotal * (rate / 100);
        return {
          productName: item.productName,
          quantity: toAmount(item.quantity),
          unitPrice: toAmount(item.quantity) > 0 ? lineSubtotal / toAmount(item.quantity) : 0,
          subtotal: lineSubtotal,
          taxRate: rate,
          taxAmount: lineTaxAmount,
          total: lineSubtotal + lineTaxAmount,
        } as PrintableInvoiceItem;
      });

    const totals = {
      subtotal: toAmount(printable.totals?.subtotal ?? subtotal),
      taxAmount: toAmount(printable.totals?.taxAmount ?? taxAmount),
      tipAmount: toAmount(printable.totals?.tipAmount ?? tipAmount),
      discountAmount: toAmount(printable.totals?.discountAmount ?? discountAmount),
      total: toAmount(printable.totals?.total ?? total),
      cashReceived: toAmount(printable.totals?.cashReceived ?? invoice?.cashReceived),
      change: toAmount(printable.totals?.change ?? invoice?.change),
    };

    const issuer = printable.issuer || {};
    const invoiceInfo = printable.invoice || {};
    const orderInfo = printable.order || {};
    const issueDate = formatDateTime(invoiceInfo.issuedAt || invoice?.createdAt);
    const sourceLabel =
      orderInfo.table
        || (orderInfo.type === 'kiosk'
          ? 'Kiosko'
          : orderInfo.type === 'takeout'
            ? 'Para llevar'
            : orderInfo.type === 'delivery'
              ? 'Delivery'
              : 'Mesa');

    const rowsHtml = computedItems
      .map((item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.productName || '')}</td>
          <td class="num">${toAmount(item.quantity).toFixed(2)}</td>
          <td class="num">${formatMoney(item.unitPrice)}</td>
          <td class="num">${formatMoney(item.subtotal)}</td>
          <td class="num">${toAmount(item.taxRate).toFixed(2)}%</td>
          <td class="num">${formatMoney(item.taxAmount)}</td>
          <td class="num">${formatMoney(item.total)}</td>
        </tr>
      `)
      .join('');

    const notesRows = computedItems
      .filter((item) => item.notes)
      .map((item) => `<li>${escapeHtml(item.productName)}: ${escapeHtml(item.notes || '')}</li>`)
      .join('');

    const html = `
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Factura ${escapeHtml(String(invoice?.invoiceNumber || invoiceInfo.invoiceNumber || ''))}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111827; margin: 0; }
    .wrap { width: 100%; }
    .header { border-bottom: 2px solid #111827; padding-bottom: 10px; margin-bottom: 10px; }
    .title { font-size: 18px; font-weight: 700; margin: 0 0 4px; }
    .sub { font-size: 12px; margin: 2px 0; color: #374151; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 12px 0; }
    .box { border: 1px solid #d1d5db; border-radius: 6px; padding: 8px; }
    .box h4 { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; color: #374151; }
    .box p { margin: 2px 0; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
    th, td { border: 1px solid #d1d5db; padding: 6px; vertical-align: top; }
    th { background: #f3f4f6; text-align: left; }
    .num { text-align: right; white-space: nowrap; }
    .totals { margin-top: 12px; width: 320px; margin-left: auto; }
    .totals-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
    .totals-row.total { font-size: 14px; font-weight: 700; border-top: 1px solid #111827; margin-top: 4px; padding-top: 8px; }
    .notes { margin-top: 10px; font-size: 11px; }
    .footer { margin-top: 16px; border-top: 1px solid #d1d5db; padding-top: 8px; font-size: 11px; color: #4b5563; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <p class="title">${escapeHtml(issuer.name || 'Comprobante Electrónico')}</p>
      <p class="sub">Cédula jurídica: ${escapeHtml((issuer.taxIdType && issuer.taxId) ? `${issuer.taxIdType}-${issuer.taxId}` : issuer.taxId || 'No registrada')}</p>
      <p class="sub">Dirección: ${escapeHtml(issuer.address || 'No registrada')}</p>
      <p class="sub">Tel: ${escapeHtml(issuer.phone || 'No registrado')} | Email: ${escapeHtml(issuer.email || 'No registrado')}</p>
    </div>

    <div class="grid">
      <div class="box">
        <h4>Datos de factura</h4>
        <p><strong>Número:</strong> ${escapeHtml(String(invoice?.invoiceNumber || invoiceInfo.invoiceNumber || 'N/A'))}</p>
        <p><strong>Fecha:</strong> ${escapeHtml(issueDate)}</p>
        <p><strong>Método de pago:</strong> ${escapeHtml(paymentMethodLabel(invoiceInfo.paymentMethod || invoice?.paymentMethod))}</p>
        <p><strong>Clave Hacienda:</strong> ${escapeHtml(invoiceInfo.haciendaKey || invoice?.haciendaKey || 'Pendiente de recepción')}</p>
        <p><strong>Consecutivo:</strong> ${escapeHtml(invoiceInfo.haciendaConsecutive || invoice?.haciendaConsecutive || 'Pendiente')}</p>
      </div>
      <div class="box">
        <h4>Datos de orden</h4>
        <p><strong>Orden:</strong> #${escapeHtml(String(orderInfo.orderNumber || order.orderNumber))}</p>
        <p><strong>Origen:</strong> ${escapeHtml(sourceLabel)}</p>
        <p><strong>Cliente:</strong> ${escapeHtml(invoice?.customerName || 'Consumidor final')}</p>
        <p><strong>Identificación:</strong> ${escapeHtml(invoice?.customerTaxId || 'No aplica')}</p>
        <p><strong>Dirección cliente:</strong> ${escapeHtml(invoice?.customerAddress || 'No aplica')}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Descripción</th>
          <th class="num">Cantidad</th>
          <th class="num">Precio Unit.</th>
          <th class="num">Subtotal</th>
          <th class="num">Impuesto %</th>
          <th class="num">Impuesto</th>
          <th class="num">Total Línea</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-row"><span>Subtotal</span><strong>${formatMoney(totals.subtotal)}</strong></div>
      <div class="totals-row"><span>Impuesto</span><strong>${formatMoney(totals.taxAmount)}</strong></div>
      <div class="totals-row"><span>Propina</span><strong>${formatMoney(totals.tipAmount)}</strong></div>
      <div class="totals-row"><span>Descuento</span><strong>- ${formatMoney(totals.discountAmount)}</strong></div>
      <div class="totals-row total"><span>Total</span><strong>${formatMoney(totals.total)}</strong></div>
      <div class="totals-row"><span>Efectivo recibido</span><strong>${formatMoney(totals.cashReceived)}</strong></div>
      <div class="totals-row"><span>Cambio</span><strong>${formatMoney(totals.change)}</strong></div>
    </div>

    ${notesRows ? `<div class="notes"><strong>Notas de cocina:</strong><ul>${notesRows}</ul></div>` : ''}

    <div class="footer">
      Comprobante generado por el sistema POS. Documento para impresión del detalle fiscal con desglose de impuestos.
    </div>
  </div>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=980,height=900');
    if (!printWindow) {
      alert('No se pudo abrir la ventana de impresion. Verifica el bloqueador de ventanas emergentes.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
        {step === 'payment' ? (
          <>
            {/* Header */}
            <div className="bg-gradient-to-r from-brand-600 to-brand-700 px-6 py-4 rounded-t-xl">
              <h2 className="text-xl font-bold text-white">Procesar Pago</h2>
              <p className="text-brand-100 text-sm">Orden #{order.orderNumber}</p>
            </div>

            {/* Contenido */}
            <div className="p-6 space-y-4">
              {/* Resumen de orden */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">${subtotal.toFixed(2)}</span>
                </div>
                {taxAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Impuestos</span>
                    <span className="font-medium">${taxAmount.toFixed(2)}</span>
                  </div>
                )}
                {tipAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Propina</span>
                    <span className="font-medium">${tipAmount.toFixed(2)}</span>
                  </div>
                )}
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Descuento</span>
                    <span className="font-medium">-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span className="text-brand-600">${total.toFixed(2)}</span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">Detalle de la orden</p>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {order.items?.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-gray-700">{item.quantity}x {item.productName}</span>
                      <span className="text-gray-600">${toAmount(item.subtotal).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Método de pago */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Método de pago</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['cash', 'card', 'qr'] as const).map((method) => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`py-2 px-3 rounded-lg font-medium text-sm transition-colors ${
                        paymentMethod === method
                          ? 'bg-brand-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {method === 'cash' ? '💵 Efectivo' : method === 'card' ? '💳 Tarjeta' : '📱 QR'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Efectivo recibido */}
              {paymentMethod === 'cash' && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Efectivo recibido</label>
                  <input
                    type="number"
                    step="0.01"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(toAmount(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  {change > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex justify-between">
                      <span className="text-green-700 text-sm font-medium">Cambio:</span>
                      <span className="text-green-700 text-sm font-bold">${change.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-2 pt-4">
                <button
                  onClick={onClose}
                  disabled={createInvoice.isPending}
                  className="flex-1 py-2 px-3 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 font-semibold rounded-lg text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => createInvoice.mutate()}
                  disabled={createInvoice.isPending || (paymentMethod === 'cash' && cashReceived < total)}
                  className="flex-1 py-2 px-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors"
                >
                  {createInvoice.isPending ? 'Procesando…' : 'Generar Factura'}
                </button>
              </div>

              {createInvoice.isError && (
                <p className="text-red-600 text-sm text-center">
                  Error: {(createInvoice.error as any)?.response?.data?.message || 'No se pudo generar la factura'}
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Invoice Step */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4 rounded-t-xl">
              <h2 className="text-xl font-bold text-white">✅ Factura Generada</h2>
              <p className="text-green-100 text-sm">Factura #{invoice?.invoiceNumber}</p>
            </div>

            <div className="p-6 space-y-4">
              {/* Detalles de factura */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3 text-sm">
                <div>
                  <p className="text-gray-500 text-xs">Número de factura</p>
                  <p className="font-mono font-bold text-lg">{invoice?.invoiceNumber}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Método de pago</p>
                  <p className="font-medium capitalize">
                    {invoice?.paymentMethod === 'cash' ? '💵 Efectivo' : invoice?.paymentMethod === 'card' ? '💳 Tarjeta' : '📱 QR'}
                  </p>
                </div>
                <div className="border-t border-gray-200 pt-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total</span>
                    <span className="font-bold text-brand-600">${toAmount(invoice?.total).toFixed(2)}</span>
                  </div>
                </div>
                {invoice?.change > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded px-3 py-2 flex justify-between">
                    <span className="text-green-700 text-sm">Cambio:</span>
                    <span className="text-green-700 font-bold">${toAmount(invoice.change).toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Botones finales */}
              <div className="flex gap-2 pt-4">
                <button
                  onClick={printInvoiceReport}
                  className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm transition-colors"
                >
                  🖨️ Imprimir
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-2 px-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-sm transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
