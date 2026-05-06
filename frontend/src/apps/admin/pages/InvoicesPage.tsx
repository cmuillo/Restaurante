import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { useActiveBranchId } from '../../../hooks/useActiveBranchId';
import { useSettings } from '../../../hooks/useSettings';
import { fmtMoney, formatCurrency } from '../../../stores/settings.store';

type InvoiceStatus = 'issued' | 'cancelled' | 'credit_note';

type HaciendaStatus = 'pending' | 'sending' | 'sent' | 'accepted' | 'rejected' | 'error' | 'contingency' | string;

type InvoiceHistoryItem = {
  id: string;
  invoiceNumber: string;
  paymentMethod: 'cash' | 'card' | 'transfer' | 'qr' | 'mixed';
  status: InvoiceStatus;
  customerName?: string;
  subtotal: number;
  taxAmount: number;
  tipAmount: number;
  discountAmount: number;
  total: number;
  cashReceived: number;
  change: number;
  createdAt: string;
  haciendaStatus?: HaciendaStatus;
  haciendaMessage?: string;
  haciendaProcessedAt?: string;
  order?: {
    id: string;
    orderNumber: number;
    type: 'dine_in' | 'takeout' | 'delivery' | 'kiosk';
    notes?: string;
    pointsUsed?: number;
    pointsDiscount?: number;
    table?: { number: number } | null;
    customer?: { name?: string; code?: string } | null;
    items?: {
      id: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
      notes?: string;
      taxRate?: number;
    }[];
    branch?: {
      name?: string;
      address?: string;
      phone?: string;
      email?: string;
    } | null;
  };
};

function toAmount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toDateInputValue(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatPaymentMethod(value?: string): string {
  if (value === 'cash') return 'Efectivo';
  if (value === 'card') return 'Tarjeta';
  if (value === 'qr') return 'QR';
  if (value === 'mixed') return 'Mixto';
  if (value === 'transfer') return 'Transferencia';
  return 'No indicado';
}

function formatHaciendaStatus(value?: HaciendaStatus): string {
  if (value === 'accepted') return 'Aceptada';
  if (value === 'rejected') return 'Rechazada';
  if (value === 'sent') return 'Enviada';
  if (value === 'sending') return 'Enviando';
  if (value === 'pending') return 'Pendiente';
  if (value === 'error') return 'Error';
  if (value === 'contingency') return 'Contingencia';
  return 'Sin enviar';
}

function getHaciendaStatusClass(value?: HaciendaStatus): string {
  if (value === 'accepted') return 'bg-emerald-100 text-emerald-700';
  if (value === 'rejected') return 'bg-red-100 text-red-700';
  if (value === 'error') return 'bg-rose-100 text-rose-700';
  if (value === 'sent' || value === 'sending') return 'bg-blue-100 text-blue-700';
  if (value === 'pending') return 'bg-amber-100 text-amber-700';
  if (value === 'contingency') return 'bg-orange-100 text-orange-700';
  return 'bg-gray-100 text-gray-700';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function printInvoice(invoice: InvoiceHistoryItem) {
  const order = invoice.order;
  const items = order?.items || [];

  const sourceLabel =
    order?.table?.number
      ? `Mesa ${order.table.number}`
      : order?.type === 'kiosk'
        ? 'Kiosko'
        : order?.type === 'takeout'
          ? 'Para llevar'
          : order?.type === 'delivery'
            ? 'Delivery'
            : 'Sin mesa';

  const rows = items
    .map((item, index) => `
      <tr>
        <td class="num">${index + 1}</td>
        <td>${escapeHtml(item.productName)}</td>
        <td class="num">${toAmount(item.quantity).toFixed(0)}</td>
        <td class="num">${fmtMoney(toAmount(item.unitPrice))}</td>
        <td class="num">${fmtMoney(toAmount(item.subtotal))}</td>
      </tr>
    `)
    .join('');

  const html = `
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Factura ${escapeHtml(invoice.invoiceNumber)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 16px; color: #111; }
    .header { border-bottom: 2px solid #111; margin-bottom: 8px; padding-bottom: 8px; }
    .row { display: flex; justify-content: space-between; gap: 12px; font-size: 12px; margin: 2px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
    th, td { border: 1px solid #ddd; padding: 6px; }
    th { background: #f2f2f2; text-align: left; }
    .num { text-align: right; }
    .totals { width: 280px; margin-left: auto; margin-top: 12px; font-size: 12px; }
    .totals .row { border-bottom: 1px solid #eee; padding: 3px 0; }
    .total { font-weight: 700; font-size: 14px; }
  </style>
</head>
<body>
  <div class="header">
    <h2 style="margin: 0;">${escapeHtml(order?.branch?.name || 'Factura')}</h2>
    <div class="row"><span>Factura:</span><strong>${escapeHtml(invoice.invoiceNumber)}</strong></div>
    <div class="row"><span>Fecha:</span><strong>${new Date(invoice.createdAt).toLocaleString()}</strong></div>
    <div class="row"><span>Orden:</span><strong>#${order?.orderNumber || '-'}</strong></div>
    <div class="row"><span>Origen:</span><strong>${escapeHtml(sourceLabel)}</strong></div>
    <div class="row"><span>Cliente:</span><strong>${escapeHtml(invoice.customerName || order?.customer?.name || 'Consumidor final')}</strong></div>
    <div class="row"><span>Método pago:</span><strong>${escapeHtml(formatPaymentMethod(invoice.paymentMethod))}</strong></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Producto</th>
        <th class="num">Cant.</th>
        <th class="num">P. Unit</th>
        <th class="num">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="5" style="text-align:center">Sin detalle de ítems</td></tr>'}
    </tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Subtotal</span><strong>${fmtMoney(toAmount(invoice.subtotal))}</strong></div>
    <div class="row"><span>Impuestos</span><strong>${fmtMoney(toAmount(invoice.taxAmount))}</strong></div>
    <div class="row"><span>Propina</span><strong>${fmtMoney(toAmount(invoice.tipAmount))}</strong></div>
    <div class="row"><span>Descuento</span><strong>-${fmtMoney(toAmount(invoice.discountAmount))}</strong></div>
    <div class="row"><span>Puntos usados</span><strong>${toAmount(order?.pointsUsed).toFixed(0)} pts</strong></div>
    <div class="row"><span>Monto con puntos</span><strong>-${fmtMoney(toAmount(order?.pointsDiscount))}</strong></div>
    <div class="row total"><span>Total</span><strong>${fmtMoney(toAmount(invoice.total))}</strong></div>
    <div class="row"><span>Efectivo recibido</span><strong>${fmtMoney(toAmount(invoice.cashReceived))}</strong></div>
    <div class="row"><span>Cambio</span><strong>${fmtMoney(toAmount(invoice.change))}</strong></div>
  </div>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=960,height=900');
  if (!w) {
    alert('No se pudo abrir la ventana de impresión.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
  w.close();
}

export default function InvoicesPage() {
  const branchId = useActiveBranchId();
  const settings = useSettings();
  const queryClient = useQueryClient();

  const today = toDateInputValue(new Date());
  const monthAgo = toDateInputValue(new Date(Date.now() - 29 * 86400_000));

  // Estado de configuración Hacienda de la sucursal seleccionada
  const { data: haciendaCfg } = useQuery<{ haciendaEnabled: boolean }>({
    queryKey: ['hacienda-config', branchId],
    queryFn: () => api.get('/hacienda/config', { params: { branchId } }).then((r) => r.data),
    enabled: !!branchId,
  });
  const haciendaEnabled = haciendaCfg?.haciendaEnabled ?? false;

  const [statusFilter, setStatusFilter] = useState<'all' | InvoiceStatus>('all');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState(monthAgo);
  const [toDate, setToDate] = useState(today);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

  const { data: invoices = [], isLoading } = useQuery<InvoiceHistoryItem[]>({
    queryKey: ['admin-invoices', branchId, fromDate, toDate],
    queryFn: () =>
      api
        .get(`/billing/invoices?branchId=${branchId}${fromDate ? `&from=${fromDate}` : ''}${toDate ? `&to=${toDate}` : ''}`)
        .then((r) => r.data),
    enabled: !!branchId,
    refetchInterval: 30_000,
  });

  const cancelInvoiceMutation = useMutation({
    mutationFn: async (payload: { id: string; reason: string }) => {
      await api.post(`/billing/invoices/${payload.id}/cancel`, { reason: payload.reason });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
    },
  });

  const resendHaciendaMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/billing/invoices/${id}/resend-hacienda`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
    },
  });

  const creditNoteMutation = useMutation({
    mutationFn: async (payload: { id: string; reason: string }) => {
      await api.post(`/billing/invoices/${payload.id}/credit-note`, { reason: payload.reason });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
    },
  });

  const handleCancelInvoice = async (invoice: InvoiceHistoryItem) => {
    if (invoice.status !== 'issued') return;
    const reason = window.prompt(`Motivo de anulación para ${invoice.invoiceNumber}:`, 'Anulación administrativa');
    if (!reason || !reason.trim()) return;
    try {
      await cancelInvoiceMutation.mutateAsync({ id: invoice.id, reason: reason.trim() });
      window.alert(`Factura ${invoice.invoiceNumber} anulada correctamente.`);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'No se pudo anular la factura.';
      window.alert(Array.isArray(message) ? message.join('\n') : String(message));
    }
  };

  const handleResendHacienda = async (invoice: InvoiceHistoryItem) => {
    const ok = window.confirm(`¿Reenviar ${invoice.invoiceNumber} a Hacienda?`);
    if (!ok) return;
    try {
      await resendHaciendaMutation.mutateAsync(invoice.id);
      window.alert(`Reenvío de ${invoice.invoiceNumber} encolado correctamente.`);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'No se pudo reenviar a Hacienda.';
      window.alert(Array.isArray(message) ? message.join('\n') : String(message));
    }
  };

  const handleCreateCreditNote = async (invoice: InvoiceHistoryItem) => {
    if (invoice.status !== 'issued') return;
    const reason = window.prompt(`Motivo de nota de credito para ${invoice.invoiceNumber}:`, 'Devolucion o ajuste administrativo');
    if (!reason || !reason.trim()) return;

    const ok = window.confirm(`¿Confirmas emitir Nota de Credito para ${invoice.invoiceNumber}?`);
    if (!ok) return;

    try {
      await creditNoteMutation.mutateAsync({ id: invoice.id, reason: reason.trim() });
      window.alert(`Nota de credito creada para ${invoice.invoiceNumber}.`);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'No se pudo emitir la nota de credito.';
      window.alert(Array.isArray(message) ? message.join('\n') : String(message));
    }
  };

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      if (!q) return true;

      return [
        inv.invoiceNumber,
        String(inv.order?.orderNumber || ''),
        inv.customerName || '',
        inv.order?.customer?.name || '',
        inv.order?.customer?.code || '',
      ].some((value) => String(value).toLowerCase().includes(q));
    });
  }, [invoices, search, statusFilter]);

  const applyQuickDateFilter = (preset: 'today' | 'week' | 'month') => {
    const now = new Date();
    const currentDay = toDateInputValue(now);

    if (preset === 'today') {
      setFromDate(currentDay);
      setToDate(currentDay);
      return;
    }

    if (preset === 'week') {
      const from = new Date(now);
      from.setDate(now.getDate() - 6);
      setFromDate(toDateInputValue(from));
      setToDate(currentDay);
      return;
    }

    const from = new Date(now);
    from.setDate(now.getDate() - 29);
    setFromDate(toDateInputValue(from));
    setToDate(currentDay);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Facturas</h2>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Indicador de Hacienda */}
          {branchId && (
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                haciendaEnabled
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${haciendaEnabled ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              Facturación electrónica {haciendaEnabled ? 'activa' : 'desactivada'}
            </span>
          )}
        </div>
      </div>

      {!branchId && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center text-amber-700 mb-4">
          Selecciona una sucursal en el panel lateral para ver sus facturas.
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Estado</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | InvoiceStatus)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">Todos los estados</option>
              <option value="issued">Emitida</option>
              <option value="cancelled">Anulada</option>
              <option value="credit_note">Nota de crédito</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Desde</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Hasta</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setStatusFilter('all');
                setFromDate('');
                setToDate('');
                setSearch('');
              }}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-3 py-2 text-sm font-medium"
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por factura, orden, cliente o código"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => applyQuickDateFilter('today')}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100"
            >
              Hoy
            </button>
            <button
              onClick={() => applyQuickDateFilter('week')}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
            >
              Ultimos 7 dias
            </button>
            <button
              onClick={() => applyQuickDateFilter('month')}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700 hover:bg-violet-100"
            >
              Ultimos 30 dias
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="max-h-[calc(100vh-310px)] overflow-auto">
        <table className="w-full min-w-[1220px] text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            <tr>
              {['Factura', 'Fecha', 'Orden', 'Cliente', 'Estado', ...(haciendaEnabled ? ['Estado Hacienda'] : []), 'Pago', 'Total', 'Acciones'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredInvoices.map((inv) => {
              const isExpanded = expandedInvoiceId === inv.id;
              const canResendHacienda = ['error', 'rejected', 'pending'].includes(String(inv.haciendaStatus || '').toLowerCase());
              return (
                <>
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-medium whitespace-nowrap">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{new Date(inv.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">#{inv.order?.orderNumber || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{inv.customerName || inv.order?.customer?.name || 'Consumidor final'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          inv.status === 'issued'
                            ? 'bg-green-100 text-green-700'
                            : inv.status === 'cancelled'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {inv.status === 'issued' ? 'Emitida' : inv.status === 'cancelled' ? 'Anulada' : 'NC'}
                      </span>
                    </td>
                    {haciendaEnabled && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getHaciendaStatusClass(inv.haciendaStatus)}`}>
                          {formatHaciendaStatus(inv.haciendaStatus)}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatPaymentMethod(inv.paymentMethod)}</td>
                    <td className="px-4 py-3 font-semibold text-brand-600 whitespace-nowrap">{formatCurrency(toAmount(inv.total), settings)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.id)}
                          className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                        >
                          {isExpanded ? 'Ocultar' : 'Detalle'}
                        </button>
                        <button
                          onClick={() => printInvoice(inv)}
                          className="px-2 py-1 text-xs rounded bg-slate-700 hover:bg-slate-800 text-white"
                        >
                          Reimprimir
                        </button>
                        <button
                          onClick={() => handleCancelInvoice(inv)}
                          disabled={inv.status !== 'issued' || cancelInvoiceMutation.isPending}
                          className="px-2 py-1 text-xs rounded bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Anular
                        </button>
                        <button
                          onClick={() => handleCreateCreditNote(inv)}
                          disabled={inv.status !== 'issued' || creditNoteMutation.isPending}
                          className="px-2 py-1 text-xs rounded bg-purple-700 hover:bg-purple-800 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Emitir NC
                        </button>
                        {haciendaEnabled && (
                          <button
                            onClick={() => handleResendHacienda(inv)}
                            disabled={!canResendHacienda || resendHaciendaMutation.isPending}
                            className="px-2 py-1 text-xs rounded bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            title={canResendHacienda ? 'Reenviar comprobante a Hacienda' : 'Solo aplica para pendientes, rechazadas o con error'}
                          >
                            Reenviar Hacienda
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr>
                      <td className="px-4 py-3 bg-gray-50" colSpan={haciendaEnabled ? 9 : 8}>
                        <div className="space-y-3">
                          <div className="text-xs text-gray-600 grid grid-cols-1 md:grid-cols-3 gap-2">
                            <p><strong>Origen:</strong> {inv.order?.table?.number ? `Mesa ${inv.order.table.number}` : inv.order?.type || 'N/A'}</p>
                            <p><strong>Código cliente:</strong> {inv.order?.customer?.code || 'N/A'}</p>
                            <p><strong>Notas:</strong> {inv.order?.notes || 'Sin notas'}</p>
                            {haciendaEnabled && (
                              <>
                                <p><strong>Estado Hacienda:</strong> {formatHaciendaStatus(inv.haciendaStatus)}</p>
                                <p><strong>Mensaje Hacienda:</strong> {inv.haciendaMessage || 'Sin mensaje'}</p>
                                <p><strong>Procesada:</strong> {inv.haciendaProcessedAt ? new Date(inv.haciendaProcessedAt).toLocaleString() : 'Pendiente'}</p>
                              </>
                            )}
                          </div>

                          <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <table className="w-full text-xs">
                              <thead className="bg-white border-b border-gray-200">
                                <tr>
                                  <th className="px-3 py-2 text-left">Producto</th>
                                  <th className="px-3 py-2 text-right">Cant.</th>
                                  <th className="px-3 py-2 text-right">Unitario</th>
                                  <th className="px-3 py-2 text-right">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 bg-white">
                                {(inv.order?.items || []).map((item) => (
                                  <tr key={item.id}>
                                    <td className="px-3 py-2">{item.productName}</td>
                                    <td className="px-3 py-2 text-right">{toAmount(item.quantity).toFixed(2)}</td>
                                    <td className="px-3 py-2 text-right">{formatCurrency(toAmount(item.unitPrice), settings)}</td>
                                    <td className="px-3 py-2 text-right">{formatCurrency(toAmount(item.subtotal), settings)}</td>
                                  </tr>
                                ))}
                                {(inv.order?.items || []).length === 0 && (
                                  <tr>
                                    <td colSpan={4} className="px-3 py-4 text-center text-gray-500">Sin detalle de ítems</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
        </div>

        {isLoading && <p className="text-center text-gray-400 py-8">Cargando facturas...</p>}
        {!isLoading && filteredInvoices.length === 0 && (
          <p className="text-center text-gray-400 py-12">No hay facturas para mostrar.</p>
        )}
      </div>
    </div>
  );
}
