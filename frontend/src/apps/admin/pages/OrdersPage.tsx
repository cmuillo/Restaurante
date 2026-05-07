import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';
import { useActiveBranchId } from '../../../hooks/useActiveBranchId';
import { useSocket } from '../../../hooks/useSocket';
import { useQueryClient } from '@tanstack/react-query';
import { Fragment, useMemo, useState } from 'react';
import { useSettings } from '../../../hooks/useSettings';
import { formatCurrency } from '../../../stores/settings.store';

interface OrderRow {
  id: string;
  orderNumber: string;
  type: string;
  status: string;
  total: number;
  createdAt: string;
  preparationStartedAt?: string | null;
  readyAt?: string | null;
  kitchenPrintedAt?: string | null;
  table?: { number: number };
  userId?: string | null;
  items?: {
    id: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    notes?: string;
    modifiers?: { id?: string; optionName: string; extraPrice?: number }[];
  }[];
  invoice?: {
    id: string;
    invoiceNumber: string;
    status?: string;
    paymentMethod?: string;
    total?: number;
    createdAt?: string;
  } | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  in_preparation: 'En cocina',
  ready: 'Lista',
  delivered: 'Entregada',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  in_preparation: 'bg-blue-100 text-blue-700',
  ready: 'bg-green-100 text-green-700',
  delivered: 'bg-purple-100 text-purple-700',
  completed: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-red-100 text-red-600',
};

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'in_preparation', label: 'En cocina' },
  { value: 'ready', label: 'Lista' },
  { value: 'delivered', label: 'Entregada' },
  { value: 'completed', label: 'Completada' },
  { value: 'cancelled', label: 'Cancelada' },
];

function isInDateRange(dateIso: string, fromDate: string, toDate: string): boolean {
  const createdAt = new Date(dateIso).getTime();
  if (!Number.isFinite(createdAt)) return false;

  if (fromDate) {
    const from = new Date(`${fromDate}T00:00:00`).getTime();
    if (createdAt < from) return false;
  }

  if (toDate) {
    const to = new Date(`${toDate}T23:59:59.999`).getTime();
    if (createdAt > to) return false;
  }

  return true;
}

function toDateInputValue(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTime(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' });
}

function kitchenStage(order: OrderRow): string {
  if (order.readyAt) return 'Lista';
  if (order.preparationStartedAt) return 'En preparación';
  return 'Nuevo';
}

function kitchenStageColor(order: OrderRow): string {
  if (order.readyAt) return 'bg-emerald-100 text-emerald-700';
  if (order.preparationStartedAt) return 'bg-sky-100 text-sky-700';
  return 'bg-amber-100 text-amber-700';
}

function minutesBetween(from?: string | null, to?: string | null): string {
  if (!from || !to) return '—';
  const diff = new Date(to).getTime() - new Date(from).getTime();
  if (!Number.isFinite(diff) || diff < 0) return '—';
  const minutes = Math.round(diff / 60000);
  return `${minutes} min`;
}

function minutesBetweenNumber(from?: string | null, to?: string | null): number | null {
  if (!from || !to) return null;
  const diff = new Date(to).getTime() - new Date(from).getTime();
  if (!Number.isFinite(diff) || diff < 0) return null;
  return diff / 60000;
}

export default function OrdersPage() {
  const branchId = useActiveBranchId();
  const settings = useSettings();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [invoiceLinkFilter, setInvoiceLinkFilter] = useState<'all' | 'with_invoice' | 'without_invoice'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [minItemsFilter, setMinItemsFilter] = useState('');
  const [minPrepMinutesFilter, setMinPrepMinutesFilter] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const { data: orders = [] } = useQuery<OrderRow[]>({
    queryKey: ['orders', branchId],
    queryFn: () =>
      api.get(`/orders?branchId=${branchId}`).then((r) => r.data),
    enabled: !!branchId,
    refetchInterval: 30_000,
  });

  const filteredOrders = useMemo(() => {
    const minItems = Number(minItemsFilter);
    const minPrepMinutes = Number(minPrepMinutesFilter);
    const hasMinItems = Number.isFinite(minItems) && minItems > 0;
    const hasMinPrep = Number.isFinite(minPrepMinutes) && minPrepMinutes > 0;

    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (invoiceLinkFilter === 'with_invoice' && !o.invoice) return false;
      if (invoiceLinkFilter === 'without_invoice' && !!o.invoice) return false;
      if (!isInDateRange(o.createdAt, fromDate, toDate)) return false;

      if (hasMinItems) {
        const totalItems = (o.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        if (totalItems < minItems) return false;
      }

      if (hasMinPrep) {
        const prepMinutes = minutesBetweenNumber(o.preparationStartedAt, o.readyAt);
        if (prepMinutes == null || prepMinutes < minPrepMinutes) return false;
      }

      return true;
    });
  }, [orders, statusFilter, invoiceLinkFilter, fromDate, toDate, minItemsFilter, minPrepMinutesFilter]);

  const applyQuickDateFilter = (preset: 'today' | 'week' | 'month') => {
    const now = new Date();
    const today = toDateInputValue(now);

    if (preset === 'today') {
      setFromDate(today);
      setToDate(today);
      return;
    }

    if (preset === 'week') {
      const from = new Date(now);
      from.setDate(now.getDate() - 6);
      setFromDate(toDateInputValue(from));
      setToDate(today);
      return;
    }

    const from = new Date(now);
    from.setDate(now.getDate() - 29);
    setFromDate(toDateInputValue(from));
    setToDate(today);
  };

  useSocket({
    branchId,
    events: {
      'kitchen:new_order': () => qc.invalidateQueries({ queryKey: ['orders'] }),
      'order:status_updated': () => qc.invalidateQueries({ queryKey: ['orders'] }),
      'order:ready': () => qc.invalidateQueries({ queryKey: ['orders'] }),
    },
    enabled: !!branchId,
  });

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Órdenes</h2>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Estado</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Factura asociada</label>
            <select
              value={invoiceLinkFilter}
              onChange={(e) => setInvoiceLinkFilter(e.target.value as 'all' | 'with_invoice' | 'without_invoice')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">Todas</option>
              <option value="with_invoice">Solo con factura</option>
              <option value="without_invoice">Solo sin factura</option>
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

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Min. ítems</label>
            <input
              type="number"
              min={0}
              step={1}
              value={minItemsFilter}
              onChange={(e) => setMinItemsFilter(e.target.value)}
              placeholder="Ej: 5"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Prep. mayor a (min)</label>
            <input
              type="number"
              min={0}
              step={1}
              value={minPrepMinutesFilter}
              onChange={(e) => setMinPrepMinutesFilter(e.target.value)}
              placeholder="Ej: 15"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setStatusFilter('all');
                setInvoiceLinkFilter('all');
                setFromDate('');
                setToDate('');
                setMinItemsFilter('');
                setMinPrepMinutesFilter('');
              }}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-3 py-2 text-sm font-medium"
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
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

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="max-h-[calc(100vh-300px)] overflow-auto">
        <table className="w-full min-w-[1460px] text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            <tr>
              {['#', 'Tipo', 'Mesa', 'Estado', 'Cocina', 'Inicio prep.', 'Lista', 'Ticket cocina', 'Espera', 'Preparación', 'Total cocina', 'Total', 'Hora', 'Acciones'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredOrders.map((o) => (
              <Fragment key={o.id}>
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-medium whitespace-nowrap">{o.orderNumber}</td>
                  <td className="px-4 py-3 capitalize text-gray-600">{o.type.toLowerCase()}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {o.type === 'kiosk'
                      ? 'Kiosko'
                      : o.type === 'takeout'
                        ? 'Para llevar'
                        : o.type === 'delivery'
                          ? 'Delivery'
                          : o.table
                            ? `Mesa ${o.table.number}`
                            : (!o.userId ? 'Kiosko' : '—')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[o.status] ?? ''}`}>
                      {STATUS_LABELS[o.status] ?? o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${kitchenStageColor(o)}`}>
                      {kitchenStage(o)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatTime(o.preparationStartedAt)}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatTime(o.readyAt)}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatTime(o.kitchenPrintedAt)}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{minutesBetween(o.createdAt, o.preparationStartedAt)}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{minutesBetween(o.preparationStartedAt, o.readyAt)}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{minutesBetween(o.createdAt, o.readyAt)}</td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{formatCurrency(Number(o.total), settings)}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {new Date(o.createdAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setExpandedOrderId(expandedOrderId === o.id ? null : o.id)}
                      className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                    >
                      {expandedOrderId === o.id ? 'Ocultar' : 'Detalle'}
                    </button>
                  </td>
                </tr>

                {expandedOrderId === o.id && (
                  <tr>
                    <td className="px-4 py-3 bg-gray-50" colSpan={14}>
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs text-gray-600">
                          <p><strong>Ítems distintos:</strong> {(o.items || []).length}</p>
                          <p><strong>Cantidad total:</strong> {(o.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)}</p>
                          <p><strong>Tiempo prep:</strong> {minutesBetween(o.preparationStartedAt, o.readyAt)}</p>
                          <p><strong>Total cocina:</strong> {minutesBetween(o.createdAt, o.readyAt)}</p>
                        </div>

                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          <table className="w-full text-xs">
                            <thead className="bg-white border-b border-gray-200">
                              <tr>
                                <th className="px-3 py-2 text-left">Producto</th>
                                <th className="px-3 py-2 text-right">Cant.</th>
                                <th className="px-3 py-2 text-right">Unitario</th>
                                <th className="px-3 py-2 text-right">Subtotal</th>
                                <th className="px-3 py-2 text-left">Detalle</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                              {(o.items || []).map((item) => (
                                <tr key={item.id}>
                                  <td className="px-3 py-2">{item.productName}</td>
                                  <td className="px-3 py-2 text-right">{Number(item.quantity || 0)}</td>
                                  <td className="px-3 py-2 text-right">{formatCurrency(Number(item.unitPrice || 0), settings)}</td>
                                  <td className="px-3 py-2 text-right">{formatCurrency(Number(item.subtotal || 0), settings)}</td>
                                  <td className="px-3 py-2 text-left text-gray-500">
                                    {item.modifiers?.length ? item.modifiers.map((m) => m.optionName).join(', ') : '—'}
                                    {item.notes ? ` · Nota: ${item.notes}` : ''}
                                  </td>
                                </tr>
                              ))}
                              {(o.items || []).length === 0 && (
                                <tr>
                                  <td colSpan={5} className="px-3 py-4 text-center text-gray-500">Sin detalle de ítems</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div className="rounded-lg border border-gray-200 bg-white p-3">
                            <p className="font-semibold text-gray-700 mb-1">Factura asociada</p>
                            {o.invoice ? (
                              <div className="space-y-1 text-gray-600">
                                <p><strong>Número:</strong> {o.invoice.invoiceNumber}</p>
                                <p><strong>Estado:</strong> {o.invoice.status || '—'}</p>
                                <p><strong>Método pago:</strong> {o.invoice.paymentMethod || '—'}</p>
                                <p><strong>Total factura:</strong> {formatCurrency(Number(o.invoice.total || 0), settings)}</p>
                                <p><strong>Fecha:</strong> {o.invoice.createdAt ? new Date(o.invoice.createdAt).toLocaleString('es-CR') : '—'}</p>
                              </div>
                            ) : (
                              <p className="text-gray-500">Esta orden aún no tiene factura asociada.</p>
                            )}
                          </div>

                          <div className="rounded-lg border border-gray-200 bg-white p-3">
                            <p className="font-semibold text-gray-700 mb-1">Comparativo rendimiento</p>
                            <div className="space-y-1 text-gray-600">
                              <p><strong>Total ítems:</strong> {(o.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)}</p>
                              <p><strong>Tiempo de preparación:</strong> {minutesBetween(o.preparationStartedAt, o.readyAt)}</p>
                              <p><strong>Min/item (prep):</strong> {(() => {
                                const totalItems = (o.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
                                const prep = (() => {
                                  if (!o.preparationStartedAt || !o.readyAt) return null;
                                  const diff = new Date(o.readyAt).getTime() - new Date(o.preparationStartedAt).getTime();
                                  if (!Number.isFinite(diff) || diff < 0) return null;
                                  return diff / 60000;
                                })();
                                if (!prep || totalItems <= 0) return '—';
                                return `${(prep / totalItems).toFixed(2)} min`;
                              })()}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        </div>
        {filteredOrders.length === 0 && (
          <p className="text-center text-gray-400 py-12">No hay órdenes para mostrar.</p>
        )}
      </div>
    </div>
  );
}
