import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '../../../lib/api';
import { useSettings } from '../../../hooks/useSettings';
import { formatCurrency } from '../../../stores/settings.store';

const CANCEL_REASONS = [
  'Error en orden',
  'Cliente se fue',
  'Producto no disponible',
  'Solicitud del cliente',
  'Otro',
];

interface BillingModalProps {
  isOpen: boolean;
  branchId: string;
  order: {
    id: string;
    orderNumber: number;
    subtotal: number;
    taxAmount: number;
    tipAmount: number;
    discountAmount: number;
    total: number;
    customer?: {
      id: string;
      name: string;
      code?: string;
      email?: string;
      loyaltyPoints?: number;
    } | null;
    items: {
      id: string;
      productName: string;
      quantity: number;
      subtotal?: number;
    }[];
  } | null;
  customer?: {
    id: string;
    name: string;
    code: string;
    email?: string;
    loyaltyPoints: number;
  } | null;
  initialStep?: 'payment' | 'cancelling';
  onClose: () => void;
  onCancelled?: () => void;
}

export type PaymentMethod = 'cash' | 'card' | 'mixed';

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
    customer?: {
      name?: string;
      code?: string;
      loyaltyPoints?: number;
    } | null;
  };
  items?: PrintableInvoiceItem[];
  totals?: {
    subtotal?: number;
    taxAmount?: number;
    tipAmount?: number;
    discountAmount?: number;
    pointsUsed?: number;
    pointsDiscount?: number;
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
  if (value === 'mixed') return 'Mixto';
  return 'No indicado';
}

function buildPos80mmReceiptHtml(params: {
  invoiceNumber: string;
  issueDate: string;
  paymentLabel: string;
  customerName: string;
  orderNumber: number;
  items: PrintableInvoiceItem[];
  totals: {
    subtotal: number;
    taxAmount: number;
    discountAmount: number;
    total: number;
    cashReceived: number;
    change: number;
  };
}) {
  const rows = params.items
    .map((item) => `
      <tr>
        <td>${escapeHtml(item.productName || '')}<br/><span class="meta">${toAmount(item.quantity).toFixed(0)} x ${formatMoney(item.unitPrice)}</span></td>
        <td class="num">${formatMoney(item.total)}</td>
      </tr>
    `)
    .join('');

  return `
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Ticket ${escapeHtml(params.invoiceNumber)}</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    html, body { width: 72mm; margin: 0; font-family: 'Courier New', monospace; font-size: 11px; color: #000; }
    .title { text-align: center; font-weight: 700; margin-bottom: 4px; }
    .meta { font-size: 10px; }
    .line { border-top: 1px dashed #000; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { vertical-align: top; padding: 2px 0; }
    .num { text-align: right; white-space: nowrap; }
    .totals td { padding: 1px 0; }
    .total td { font-weight: 700; font-size: 12px; }
    .center { text-align: center; }
  </style>
</head>
<body>
  <div class="title">FACTURA / TICKET</div>
  <div class="center meta">#${escapeHtml(params.invoiceNumber)}</div>
  <div class="center meta">${escapeHtml(params.issueDate)}</div>
  <div class="line"></div>
  <div class="meta">Orden: #${params.orderNumber}</div>
  <div class="meta">Cliente: ${escapeHtml(params.customerName)}</div>
  <div class="meta">Pago: ${escapeHtml(params.paymentLabel)}</div>
  <div class="line"></div>
  <table>
    ${rows}
  </table>
  <div class="line"></div>
  <table class="totals">
    <tr><td>Subtotal</td><td class="num">${formatMoney(params.totals.subtotal)}</td></tr>
    <tr><td>Impuestos</td><td class="num">${formatMoney(params.totals.taxAmount)}</td></tr>
    <tr><td>Descuento</td><td class="num">-${formatMoney(params.totals.discountAmount)}</td></tr>
    <tr class="total"><td>Total</td><td class="num">${formatMoney(params.totals.total)}</td></tr>
    ${params.totals.cashReceived > 0 ? `<tr><td>Efectivo</td><td class="num">${formatMoney(params.totals.cashReceived)}</td></tr>` : ''}
    ${params.totals.change > 0 ? `<tr><td>Cambio</td><td class="num">${formatMoney(params.totals.change)}</td></tr>` : ''}
  </table>
  <div class="line"></div>
  <div class="center meta">Gracias por su compra</div>
</body>
</html>`;
}

export function BillingModal({ isOpen, branchId, order, customer, initialStep = 'payment', onClose, onCancelled }: BillingModalProps) {
  const settings = useSettings();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [mixedCashAmount, setMixedCashAmount] = useState<number>(0);
  const [mixedCashReceived, setMixedCashReceived] = useState<number>(0);
  const [usePoints, setUsePoints] = useState<boolean>(false);
  const [pointsToUse, setPointsToUse] = useState<number>(0);
  const [invoiceEmail, setInvoiceEmail] = useState<string>('');
  const [invoice, setInvoice] = useState<any>(null);
  const [step, setStep] = useState<'payment' | 'cancelling' | 'cancelled' | 'invoice'>(initialStep);
  const [cancelReason, setCancelReason] = useState<string>(CANCEL_REASONS[0]);
  const [cancelNotes, setCancelNotes] = useState<string>('');
  const [currencyCode, setCurrencyCode] = useState<'CRC' | 'USD' | 'EUR'>('CRC');
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [exchangeRates, setExchangeRates] = useState<{ usd: number; eur: number } | null>(null);
  const [loadingRates, setLoadingRates] = useState(false);

  useEffect(() => {
    if (!isOpen || !order) return;
    setPaymentMethod('cash');
    setCashReceived(toAmount(order.total));
    setMixedCashAmount(0);
    setMixedCashReceived(0);
    setInvoiceEmail(customer?.email || order.customer?.email || '');
    setInvoice(null);
    setStep(initialStep);
    setUsePoints(false);
    setPointsToUse(0);
    setCancelReason(CANCEL_REASONS[0]);
    setCancelNotes('');
    setCurrencyCode('CRC');
    setExchangeRate(1);
  }, [isOpen, order]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Cargar tipos de cambio al abrir el modal
  useEffect(() => {
    if (!isOpen) return;
    const fetchExchangeRates = async () => {
      try {
        setLoadingRates(true);
        const response = await api.get('/hacienda/exchange-rates');
        if (response.data?.usd && response.data?.eur) {
          setExchangeRates({
            usd: response.data.usd.value,
            eur: response.data.eur.value,
          });
        }
      } catch (error) {
        console.warn('No se pudieron cargar los tipos de cambio', error);
      } finally {
        setLoadingRates(false);
      }
    };
    fetchExchangeRates();
  }, [isOpen]);

  // Actualizar tipo de cambio cuando cambia moneda
  useEffect(() => {
    if (currencyCode === 'CRC') {
      setExchangeRate(1);
    } else if (currencyCode === 'USD' && exchangeRates?.usd) {
      setExchangeRate(exchangeRates.usd);
    } else if (currencyCode === 'EUR' && exchangeRates?.eur) {
      setExchangeRate(exchangeRates.eur);
    }
  }, [currencyCode, exchangeRates]);

  // Mantiene el efectivo sugerido alineado al total final cuando cambia el descuento por puntos.
  useEffect(() => {
    if (!isOpen || !order) return;
    const effectiveTotal = Math.max(0, toAmount(order.total) - (usePoints ? pointsToUse : 0));
    if (paymentMethod === 'cash') {
      setCashReceived(effectiveTotal);
      return;
    }
    if (paymentMethod === 'mixed') {
      const suggestedCash = Math.min(mixedCashAmount, effectiveTotal);
      setMixedCashAmount(suggestedCash);
      setMixedCashReceived(suggestedCash);
    }
  }, [isOpen, order, paymentMethod, usePoints, pointsToUse]);

  const cancelOrder = useMutation({
    mutationFn: () => {
      const reason = cancelNotes.trim()
        ? `${cancelReason}: ${cancelNotes.trim()}`
        : cancelReason;
      return api
        .post(`/orders/${order?.id}/cancel?branchId=${branchId}`, { reason })
        .then((r) => r.data);
    },
    onSuccess: () => {
      setStep('cancelled');
    },
  });

  const createInvoice = useMutation({
    mutationFn: () =>
      api
        .post('/billing/invoices', {
          orderId: order?.id,
          paymentMethod,
          paymentDetails: paymentMethod === 'mixed'
            ? {
              cash: mixedCashAmount,
              card: Math.max(0, discountedTotal - mixedCashAmount),
            }
            : undefined,
          cashReceived: paymentMethod === 'cash'
            ? cashReceived
            : paymentMethod === 'mixed'
              ? mixedCashReceived
              : 0,
          customerName: customer?.name || order?.customer?.name,
          pointsUsed: usePoints ? pointsToUse : 0,
          currencyCode: currencyCode !== 'CRC' ? currencyCode : undefined,
          exchangeRate: currencyCode !== 'CRC' ? exchangeRate : undefined,
        })
        .then((r) => r.data),
    onSuccess: (data) => {
      setInvoice(data);
      setStep('invoice');
    },
  });

  const sendInvoiceEmail = useMutation({
    mutationFn: () => api.post(`/billing/invoices/${invoice?.id}/send-email`, { email: invoiceEmail }).then((r) => r.data),
  });

  if (!isOpen || !order) return null;

  const subtotal = toAmount(order.subtotal);
  const taxAmount = toAmount(order.taxAmount);
  const tipAmount = toAmount(order.tipAmount);
  const discountAmount = toAmount(order.discountAmount);
  const total = toAmount(order.total);
  const availableLoyaltyPoints = customer?.loyaltyPoints ?? order.customer?.loyaltyPoints ?? 0;
  const maxPointsAllowed = Math.min(availableLoyaltyPoints, Math.max(0, total));
  const discountedTotal = Math.max(0, total - (usePoints ? pointsToUse : 0));
  const change = paymentMethod === 'cash' ? Math.max(0, cashReceived - discountedTotal) : 0;
  const mixedCardAmount = Math.max(0, discountedTotal - mixedCashAmount);
  const mixedChange = paymentMethod === 'mixed' ? Math.max(0, mixedCashReceived - mixedCashAmount) : 0;
  const convertedTotal = currencyCode !== 'CRC' && exchangeRate > 0
    ? discountedTotal / exchangeRate
    : discountedTotal;

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
      discountAmount: toAmount(printable.totals?.discountAmount ?? discountAmount),
      total: toAmount(printable.totals?.total ?? total),
      cashReceived: toAmount(printable.totals?.cashReceived ?? invoice?.cashReceived),
      change: toAmount(printable.totals?.change ?? invoice?.change),
    };

    const invoiceInfo = printable.invoice || {};
    const html = buildPos80mmReceiptHtml({
      invoiceNumber: String(invoice?.invoiceNumber || invoiceInfo.invoiceNumber || 'N/A'),
      issueDate: formatDateTime(invoiceInfo.issuedAt || invoice?.createdAt),
      paymentLabel: paymentMethodLabel(invoiceInfo.paymentMethod || invoice?.paymentMethod),
      customerName: invoice?.customerName || printable.order?.customer?.name || customer?.name || order?.customer?.name || 'Consumidor final',
      orderNumber: order.orderNumber,
      items: computedItems,
      totals,
    });

    const frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    document.body.appendChild(frame);

    const win = frame.contentWindow;
    const doc = win?.document;
    if (!doc || !frame.contentWindow) {
      document.body.removeChild(frame);
      alert('No se pudo abrir el documento de impresion.');
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      win.focus();
      win.print();
      setTimeout(() => {
        if (document.body.contains(frame)) document.body.removeChild(frame);
      }, 1200);
    }, 100);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full mx-4 max-h-[92vh] overflow-hidden flex flex-col">
        {step === 'payment' ? (
          <>
            {/* Header */}
            <div className="bg-gradient-to-r from-brand-600 to-brand-700 px-6 py-4 rounded-t-xl">
              <h2 className="text-xl font-bold text-white">Procesar Pago</h2>
              <p className="text-brand-100 text-sm">Orden #{order.orderNumber}</p>
            </div>

            {/* Contenido */}
            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-y-auto">
              {/* Resumen de orden */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">{formatCurrency(subtotal, settings)}</span>
                </div>
                {taxAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Impuestos</span>
                    <span className="font-medium">{formatCurrency(taxAmount, settings)}</span>
                  </div>
                )}
                {tipAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Propina</span>
                    <span className="font-medium">{formatCurrency(tipAmount, settings)}</span>
                  </div>
                )}
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Descuento</span>
                    <span className="font-medium">-{formatCurrency(discountAmount, settings)}</span>
                  </div>
                )}
                {usePoints && pointsToUse > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-600">Descuento por puntos</span>
                    <span className="font-medium text-blue-600">-{formatCurrency(pointsToUse, settings)}</span>
                  </div>
                )}
                <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span className="text-brand-600">{formatCurrency(discountedTotal, settings)}</span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">Detalle de la orden</p>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {order.items?.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-gray-700">{item.quantity}x {item.productName}</span>
                      <span className="text-gray-600">{formatCurrency(toAmount(item.subtotal), settings)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {(customer || order.customer) && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 space-y-1">
                  <p className="text-sm font-semibold text-indigo-900">Cliente</p>
                  <p className="text-sm text-indigo-800">{customer?.name || order.customer?.name}</p>
                  <p className="text-xs text-indigo-700">Código: {customer?.code || order.customer?.code || 'N/A'}</p>
                  <p className="text-xs text-indigo-700">Puntos actuales: {customer?.loyaltyPoints ?? order.customer?.loyaltyPoints ?? 0}</p>
                </div>
              )}

              {/* Puntos del cliente */}
              {(customer || order.customer) && ((customer?.loyaltyPoints ?? order.customer?.loyaltyPoints ?? 0) > 0) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-blue-900">Puntos disponibles</p>
                    <p className="text-lg font-bold text-blue-700">{customer?.loyaltyPoints ?? order.customer?.loyaltyPoints ?? 0}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="usePointsCheckbox"
                      checked={usePoints}
                      onChange={(e) => {
                        setUsePoints(e.target.checked);
                        if (e.target.checked) {
                          setPointsToUse(maxPointsAllowed);
                        } else {
                          setPointsToUse(0);
                        }
                      }}
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                    <label htmlFor="usePointsCheckbox" className="text-sm font-medium text-blue-900 cursor-pointer">
                      Usar puntos como descuento
                    </label>
                  </div>
                  {usePoints && (
                    <div className="space-y-2">
                      <input
                        type="number"
                        min="0"
                        max={maxPointsAllowed}
                        value={pointsToUse}
                        onChange={(e) => setPointsToUse(Math.min(Number(e.target.value), maxPointsAllowed))}
                        className="w-full border border-blue-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Cantidad de puntos"
                      />
                      <p className="text-xs text-blue-600">
                        Descuento: {formatCurrency(pointsToUse, settings)} | Puntos max: {maxPointsAllowed}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Moneda */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Moneda</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['CRC', 'USD', 'EUR'] as const).map((currency) => (
                    <button
                      key={currency}
                      onClick={() => setCurrencyCode(currency)}
                      className={`py-2 px-3 rounded-lg font-medium text-sm transition-colors ${
                        currencyCode === currency
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {currency === 'CRC' ? '₡ CRC' : currency === 'USD' ? '$ USD' : '€ EUR'}
                    </button>
                  ))}
                </div>
                {currencyCode !== 'CRC' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                    <p className="text-xs text-amber-700">
                      <span className="font-semibold">Tipo de cambio {currencyCode}:</span>{' '}
                      {loadingRates ? (
                        <span>Cargando...</span>
                      ) : (
                        <span className="font-bold">{exchangeRate?.toFixed(2)}</span>
                      )}
                    </p>
                    <input
                      type="number"
                      step="0.01"
                      value={exchangeRate}
                      onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1)}
                      className="w-full border border-amber-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="Tipo de cambio"
                      disabled={loadingRates}
                    />
                    <p className="text-xs text-amber-600">Puedes ajustar manualmente si es necesario</p>
                    <p className="text-xs text-amber-700 font-medium">
                      Monto a pagar aproximado: {currencyCode === 'USD' ? '$' : '€'} {convertedTotal.toFixed(2)} ({formatCurrency(discountedTotal, settings)})
                    </p>
                  </div>
                )}
              </div>

              {/* Método de pago */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Método de pago</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['cash', 'card', 'mixed'] as const).map((method) => (
                    <button
                      key={method}
                      onClick={() => {
                        setPaymentMethod(method);
                        if (method === 'cash') {
                          setCashReceived(discountedTotal);
                        }
                        if (method === 'mixed') {
                          const suggested = Number((discountedTotal * 0.5).toFixed(2));
                          setMixedCashAmount(suggested);
                          setMixedCashReceived(suggested);
                        }
                      }}
                      className={`py-2 px-3 rounded-lg font-medium text-sm transition-colors ${
                        paymentMethod === method
                          ? 'bg-brand-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {method === 'cash' ? '💵 Efectivo' : method === 'card' ? '💳 Tarjeta' : '🔀 Mixto'}
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
                      <span className="text-green-700 text-sm font-bold">{formatCurrency(change, settings)}</span>
                    </div>
                  )}
                </div>
              )}

              {paymentMethod === 'mixed' && (
                <div className="space-y-3 bg-gray-50 rounded-lg border border-gray-200 p-3">
                  <p className="text-sm font-semibold text-gray-700">Pago dividido</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-600">Parte en efectivo</label>
                      <input
                        type="number"
                        min="0"
                        max={discountedTotal}
                        step="0.01"
                        value={mixedCashAmount}
                        onChange={(e) => {
                          const amount = Math.min(discountedTotal, Math.max(0, toAmount(e.target.value)));
                          setMixedCashAmount(amount);
                          setMixedCashReceived(amount);
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Parte en tarjeta</label>
                      <input
                        type="number"
                        value={mixedCardAmount}
                        readOnly
                        className="w-full border border-gray-200 bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-700"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Efectivo recibido</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={mixedCashReceived}
                      onChange={(e) => setMixedCashReceived(Math.max(0, toAmount(e.target.value)))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  {mixedChange > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex justify-between">
                      <span className="text-green-700 text-sm font-medium">Cambio (efectivo):</span>
                      <span className="text-green-700 text-sm font-bold">{formatCurrency(mixedChange, settings)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Botones */}
              <div className="lg:col-span-2 flex gap-2 pt-4">
                <button
                  onClick={onClose}
                  disabled={createInvoice.isPending}
                  className="py-2 px-3 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 font-semibold rounded-lg text-sm transition-colors"
                >
                  Cerrar
                </button>
                <button
                  onClick={() => setStep('cancelling')}
                  disabled={createInvoice.isPending}
                  className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors"
                >
                  🚫 Cancelar Orden
                </button>
                <button
                  onClick={() => createInvoice.mutate()}
                  disabled={
                    createInvoice.isPending
                    || (paymentMethod === 'cash' && cashReceived < discountedTotal)
                    || (paymentMethod === 'mixed' && (mixedCashAmount <= 0 || mixedCashAmount >= discountedTotal || mixedCashReceived < mixedCashAmount))
                  }
                  className="flex-1 py-2 px-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors"
                >
                  {createInvoice.isPending ? 'Procesando…' : 'Facturar'}
                </button>
              </div>

              {createInvoice.isError && (
                <p className="lg:col-span-2 text-red-600 text-sm text-center">
                  {String((createInvoice.error as any)?.response?.data?.message || '').toLowerCase().includes('ya tiene una factura')
                    ? 'Esta orden ya fue facturada anteriormente. Actualiza la lista de pendientes para ver el estado correcto.'
                    : `Error: ${(createInvoice.error as any)?.response?.data?.message || 'No se pudo generar la factura'}`}
                </p>
              )}
            </div>
          </>
        ) : step === 'cancelling' ? (
          <>
            {/* Cancel Step */}
            <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 rounded-t-xl">
              <h2 className="text-xl font-bold text-white">🚫 Cancelar Orden</h2>
              <p className="text-red-100 text-sm">Orden #{order.orderNumber} · {order.items?.length} ítem(s) · {formatCurrency(total, settings)}</p>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-800 text-sm font-medium">Esta acción es irreversible. La orden quedará marcada como CANCELADA y será removida del módulo de cocina.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Motivo de cancelación</label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  {CANCEL_REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Notas adicionales <span className="font-normal text-gray-400">(opcional)</span></label>
                <textarea
                  value={cancelNotes}
                  onChange={(e) => setCancelNotes(e.target.value)}
                  rows={3}
                  maxLength={250}
                  placeholder="Detalles adicionales sobre la cancelación..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                />
              </div>

              {cancelOrder.isError && (
                <p className="text-red-600 text-sm text-center">
                  {(cancelOrder.error as any)?.response?.data?.message || 'No se pudo cancelar la orden'}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setStep('payment')}
                  disabled={cancelOrder.isPending}
                  className="flex-1 py-2 px-3 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 font-semibold rounded-lg text-sm transition-colors"
                >
                  Volver
                </button>
                <button
                  onClick={() => cancelOrder.mutate()}
                  disabled={cancelOrder.isPending}
                  className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors"
                >
                  {cancelOrder.isPending ? 'Cancelando…' : 'Confirmar Cancelación'}
                </button>
              </div>
            </div>
          </>
        ) : step === 'cancelled' ? (
          <>
            {/* Cancelled Step */}
            <div className="bg-gradient-to-r from-gray-600 to-gray-700 px-6 py-4 rounded-t-xl">
              <h2 className="text-xl font-bold text-white">✅ Orden Cancelada</h2>
              <p className="text-gray-200 text-sm">Orden #{order.orderNumber}</p>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <p className="text-gray-700"><strong>Motivo:</strong> {cancelReason}{cancelNotes ? `: ${cancelNotes}` : ''}</p>
                <p className="text-gray-500 text-xs">La orden fue removida del módulo de cocina y registrada como cancelada.</p>
              </div>

              <button
                onClick={() => { onCancelled ? onCancelled() : onClose(); }}
                className="w-full py-2 px-3 bg-gray-700 hover:bg-gray-800 text-white font-semibold rounded-lg text-sm transition-colors"
              >
                Cerrar
              </button>
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
                    {invoice?.paymentMethod === 'cash'
                      ? '💵 Efectivo'
                      : invoice?.paymentMethod === 'card'
                        ? '💳 Tarjeta'
                        : '🔀 Mixto'}
                  </p>
                  {invoice?.paymentMethod === 'mixed' && invoice?.paymentDetails && (
                    <p className="text-xs text-gray-500 mt-1">
                      Efectivo: {formatCurrency(toAmount(invoice.paymentDetails.cash), settings)} · Tarjeta: {formatCurrency(toAmount(invoice.paymentDetails.card), settings)}
                    </p>
                  )}
                </div>
                <div className="border-t border-gray-200 pt-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total</span>
                    <span className="font-bold text-brand-600">{formatCurrency(toAmount(invoice?.total), settings)}</span>
                  </div>
                </div>
                {invoice?.change > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded px-3 py-2 flex justify-between">
                    <span className="text-green-700 text-sm">Cambio:</span>
                    <span className="text-green-700 font-bold">{formatCurrency(toAmount(invoice.change), settings)}</span>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <label className="text-sm font-semibold text-gray-700">Enviar factura por correo</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={invoiceEmail}
                    onChange={(e) => setInvoiceEmail(e.target.value)}
                    placeholder="cliente@correo.com"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <button
                    onClick={() => sendInvoiceEmail.mutate()}
                    disabled={sendInvoiceEmail.isPending || !invoiceEmail.trim()}
                    className="px-3 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors"
                  >
                    {sendInvoiceEmail.isPending ? 'Enviando…' : 'Enviar'}
                  </button>
                </div>
                {sendInvoiceEmail.isSuccess && (
                  <p className="text-xs text-green-700">Factura enviada correctamente.</p>
                )}
                {sendInvoiceEmail.isError && (
                  <p className="text-xs text-red-600">
                    {(sendInvoiceEmail.error as any)?.response?.data?.message || 'No se pudo enviar la factura por correo'}
                  </p>
                )}
                <p className="text-xs text-gray-500">Adjunto: factura en PDF tamaño carta.</p>
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
