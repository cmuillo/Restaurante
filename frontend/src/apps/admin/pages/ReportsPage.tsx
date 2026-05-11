import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';
import { useActiveBranchId } from '../../../hooks/useActiveBranchId';
import { useSettings } from '../../../hooks/useSettings';
import { formatCurrency } from '../../../stores/settings.store';

type DateRange = 'week' | 'month' | 'custom';
type InvoiceFilter = 'all' | 'points';

type InvoiceItem = {
  id: string;
  invoiceNumber: string;
  paymentMethod?: string;
  paymentDetails?: Record<string, number>;
  status?: string;
  customerName?: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  createdAt: string;
  order?: {
    pointsUsed?: number;
    pointsDiscount?: number;
    customer?: { name?: string; code?: string } | null;
  };
};

type ExpenseItem = {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
};

type TopCustomerItem = {
  customerId: string;
  customerName: string;
  customerCode?: string;
  purchaseCount: number;
  totalSpent: number;
  lastPurchaseAt: string;
};

type CategorySalesItem = {
  categoryId: string;
  categoryName: string;
  orderCount: number;
  totalQuantity: number;
  totalRevenue: number;
  percentage: number;
};

type CashShiftItem = {
  id: string;
  openedAt: string;
  closedAt?: string | null;
  openingCash: number;
  closingCash?: number | null;
  expectedCash?: number | null;
  cashDifference?: number | null;
  openedBy?: { name?: string } | null;
  closedBy?: { name?: string } | null;
};

type CashMovementItem = {
  id: string;
  createdAt: string;
  shiftId: string;
  direction: 'IN' | 'OUT';
  category: 'CHANGE' | 'PETTY_CASH' | 'REPLENISHMENT' | 'WITHDRAWAL' | 'DEPOSIT' | 'ADJUSTMENT' | 'OTHER';
  amount: number;
  reason: string;
  notes?: string;
  createdBy?: { name?: string } | null;
};

function toDateInputValue(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function escapeCsv(value: unknown): string {
  const text = String(value ?? '');
  if (/[",\n;]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsv).join(','));
  const csv = `\uFEFF${lines.join('\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function labelPaymentMethod(value?: string): string {
  if (value === 'cash') return 'Efectivo';
  if (value === 'card') return 'Tarjeta';
  if (value === 'qr') return 'QR';
  if (value === 'transfer') return 'Transferencia';
  if (value === 'mixed') return 'Mixto';
  return 'No indicado';
}

function labelCashCategory(value: CashMovementItem['category']): string {
  if (value === 'CHANGE') return 'Cambio';
  if (value === 'PETTY_CASH') return 'Caja chica';
  if (value === 'REPLENISHMENT') return 'Reposicion';
  if (value === 'WITHDRAWAL') return 'Retiro';
  if (value === 'DEPOSIT') return 'Deposito';
  if (value === 'ADJUSTMENT') return 'Ajuste';
  return 'Otro';
}

function dateOnly(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CR');
}

export default function ReportsPage() {
  const branchId = useActiveBranchId();
  const settings = useSettings();

  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceFilter>('all');
  const today = toDateInputValue(new Date());
  const thirtyDaysAgo = toDateInputValue(new Date(Date.now() - 30 * 86400_000));

  const [customFrom, setCustomFrom] = useState(thirtyDaysAgo);
  const [customTo, setCustomTo] = useState(today);

  const from = dateRange === 'custom' ? customFrom : dateRange === 'week'
    ? toDateInputValue(new Date(Date.now() - 7 * 86400_000))
    : thirtyDaysAgo;
  const to = dateRange === 'custom' ? customTo : today;
  const fileSuffix = `${from || 'all'}_${to || 'all'}`;

  const { data: salesRange } = useQuery({
    queryKey: ['reports-sales-range', branchId, from, to],
    queryFn: () =>
      api.get(`/reports/sales-by-range?branchId=${branchId}&from=${from}&to=${to}`).then((r) => r.data),
    enabled: !!branchId,
  });

  const { data: invoices = [] } = useQuery<InvoiceItem[]>({
    queryKey: ['reports-invoices', branchId, from, to],
    queryFn: () =>
      api.get(`/billing/invoices?branchId=${branchId}&from=${from}&to=${to}`).then((r) => r.data),
    enabled: !!branchId,
  });

  const { data: expenses = [] } = useQuery<ExpenseItem[]>({
    queryKey: ['reports-expenses', branchId, from, to],
    queryFn: () =>
      api.get(`/expenses?branchId=${branchId}&from=${from}&to=${to}`).then((r) => r.data),
    enabled: !!branchId,
  });

  const { data: topCustomers = [] } = useQuery<TopCustomerItem[]>({
    queryKey: ['reports-top-customers', branchId, from, to],
    queryFn: () =>
      api.get(`/reports/top-customers?branchId=${branchId}&from=${from}&to=${to}&limit=50`).then((r) => r.data),
    enabled: !!branchId,
  });

  const { data: categorySales = [] } = useQuery<CategorySalesItem[]>({
    queryKey: ['reports-sales-by-category', branchId, from, to],
    queryFn: () =>
      api.get(`/reports/sales-by-category?branchId=${branchId}&from=${from}&to=${to}`).then((r) => r.data),
    enabled: !!branchId,
  });

  const { data: cashShifts = [] } = useQuery<CashShiftItem[]>({
    queryKey: ['reports-cash-shifts', branchId, from, to],
    queryFn: () =>
      api.get(`/reports/cash-shifts?branchId=${branchId}&from=${from}&to=${to}`).then((r) => r.data),
    enabled: !!branchId,
  });

  const { data: cashMovements = [] } = useQuery<CashMovementItem[]>({
    queryKey: ['reports-cash-movements', branchId, from, to],
    queryFn: () =>
      api.get(`/reports/cash-movements?branchId=${branchId}&from=${from}&to=${to}`).then((r) => r.data),
    enabled: !!branchId,
  });

  const paymentSummary = useMemo(() => {
    const map = new Map<string, { invoices: number; total: number }>();

    const addToMethod = (method: string, amount: number) => {
      const key = method || 'unknown';
      const current = map.get(key) ?? { invoices: 0, total: 0 };
      if (amount > 0) {
        current.invoices += 1;
        current.total += amount;
      }
      map.set(key, current);
    };

    for (const inv of invoices) {
      const method = inv.paymentMethod || 'unknown';

      if (method === 'mixed') {
        const mixedCash = Number(inv.paymentDetails?.cash ?? 0);
        const mixedCard = Number(inv.paymentDetails?.card ?? 0);

        if (mixedCash > 0) addToMethod('cash', mixedCash);
        if (mixedCard > 0) addToMethod('card', mixedCard);
        continue;
      }

      addToMethod(method, Number(inv.total || 0));
    }

    return Array.from(map.entries())
      .map(([method, values]) => ({ method, ...values }))
      .sort((a, b) => b.total - a.total);
  }, [invoices]);

  const totalExpenses = useMemo(
    () => expenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0),
    [expenses],
  );

  const pointsDiscountRows = useMemo(
    () => invoices.filter((inv) => Number(inv.order?.pointsDiscount || 0) > 0),
    [invoices],
  );

  const filteredInvoices = useMemo(
    () => (invoiceFilter === 'points'
      ? invoices.filter((inv) => Number(inv.order?.pointsDiscount || 0) > 0)
      : invoices),
    [invoices, invoiceFilter],
  );

  const totalPointsDiscount = useMemo(
    () => pointsDiscountRows.reduce((sum, inv) => sum + Number(inv.order?.pointsDiscount || 0), 0),
    [pointsDiscountRows],
  );

  const net = Number(salesRange?.total || 0) - totalExpenses;
  const totalCashIn = useMemo(
    () => cashMovements.filter((row) => row.direction === 'IN').reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [cashMovements],
  );
  const totalCashOut = useMemo(
    () => cashMovements.filter((row) => row.direction === 'OUT').reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [cashMovements],
  );

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reportes Contables</h1>
        <p className="text-gray-600 mt-1">Consultas tabulares de ventas, facturación, métodos de pago y gastos</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {(['week', 'month'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                dateRange === range
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {range === 'week' ? 'Última semana' : 'Último mes'}
            </button>
          ))}
          <button
            onClick={() => setDateRange('custom')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              dateRange === 'custom'
                ? 'bg-brand-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Personalizado
          </button>
        </div>

        {dateRange === 'custom' && (
          <div className="flex gap-3">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-amber-500/15 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3">
          <div className="bg-amber-500/20 rounded-lg p-2 text-2xl flex-shrink-0">💰</div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-amber-300 truncate">Ventas facturadas</p>
            <p className="text-xl font-bold text-amber-100 mt-0.5 truncate">{formatCurrency(salesRange?.total || 0, settings)}</p>
          </div>
        </div>
        <div className="bg-slate-500/15 border border-slate-500/30 rounded-xl p-4 flex items-center gap-3">
          <div className="bg-slate-500/20 rounded-lg p-2 text-2xl flex-shrink-0">📑</div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-300 truncate">Impuestos</p>
            <p className="text-xl font-bold text-slate-100 mt-0.5 truncate">{formatCurrency(salesRange?.tax || 0, settings)}</p>
          </div>
        </div>
        <div className="bg-red-500/15 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <div className="bg-red-500/20 rounded-lg p-2 text-2xl flex-shrink-0">🧾</div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-red-300 truncate">Gastos</p>
            <p className="text-xl font-bold text-red-100 mt-0.5 truncate">{formatCurrency(totalExpenses, settings)}</p>
          </div>
        </div>
        <div className={`rounded-xl p-4 flex items-center gap-3 ${net >= 0 ? 'bg-green-500/15 border border-green-500/30' : 'bg-red-500/15 border border-red-500/30'}`}>
          <div className={`rounded-lg p-2 text-2xl flex-shrink-0 ${net >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>📊</div>
          <div className="min-w-0">
            <p className={`text-xs font-medium truncate ${net >= 0 ? 'text-green-300' : 'text-red-300'}`}>Resultado neto</p>
            <p className={`text-xl font-bold mt-0.5 truncate ${net >= 0 ? 'text-green-100' : 'text-red-100'}`}>{formatCurrency(net, settings)}</p>
          </div>
        </div>
        <div className="bg-blue-500/15 border border-blue-500/30 rounded-xl p-4 flex items-center gap-3">
          <div className="bg-blue-500/20 rounded-lg p-2 text-2xl flex-shrink-0">🎯</div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-blue-300 truncate">Desc. por puntos</p>
            <p className="text-xl font-bold text-blue-100 mt-0.5 truncate">{formatCurrency(totalPointsDiscount, settings)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-gray-900">Libro diario de ventas</h2>
          <button
            onClick={() => downloadCsv(
              `reporte_libro_diario_${fileSuffix}.csv`,
              ['Fecha', 'Facturas', 'Impuestos', 'Descuento puntos', 'Total'],
              (salesRange?.dailyBreakdown || []).map((row: any) => [
                dateOnly(row.date),
                row.orderCount,
                Number(row.tax || 0).toFixed(2),
                Number(row.pointsDiscount || 0).toFixed(2),
                Number(row.total || 0).toFixed(2),
              ]),
            )}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            Exportar CSV
          </button>
        </div>
        <div className="overflow-auto max-h-80">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Fecha</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Facturas</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Impuestos</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Descuento puntos</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(salesRange?.dailyBreakdown || []).map((row: any) => (
                <tr key={row.date}>
                  <td className="px-4 py-2">{dateOnly(row.date)}</td>
                  <td className="px-4 py-2">{row.orderCount}</td>
                  <td className="px-4 py-2">{formatCurrency(row.tax || 0, settings)}</td>
                  <td className="px-4 py-2">{formatCurrency(row.pointsDiscount || 0, settings)}</td>
                  <td className="px-4 py-2 font-semibold">{formatCurrency(row.total || 0, settings)}</td>
                </tr>
              ))}
              {(salesRange?.dailyBreakdown || []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">Sin datos para el rango seleccionado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-gray-900">Resumen por método de pago</h2>
          <button
            onClick={() => downloadCsv(
              `reporte_metodos_pago_${fileSuffix}.csv`,
              ['Método', 'Facturas', 'Monto'],
              paymentSummary.map((row) => [
                labelPaymentMethod(row.method),
                row.invoices,
                Number(row.total || 0).toFixed(2),
              ]),
            )}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            Exportar CSV
          </button>
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Método</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Facturas</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paymentSummary.map((row) => (
                <tr key={row.method}>
                  <td className="px-4 py-2">{labelPaymentMethod(row.method)}</td>
                  <td className="px-4 py-2">{row.invoices}</td>
                  <td className="px-4 py-2 font-semibold">{formatCurrency(row.total, settings)}</td>
                </tr>
              ))}
              {paymentSummary.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-gray-500">Sin facturas en el rango seleccionado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-gray-900">Clientes con más compras</h2>
          <button
            onClick={() => downloadCsv(
              `reporte_clientes_top_${fileSuffix}.csv`,
              ['Cliente', 'Código', 'Compras', 'Total comprado', 'Última compra'],
              topCustomers.map((c) => [
                c.customerName,
                c.customerCode || '-',
                c.purchaseCount,
                Number(c.totalSpent || 0).toFixed(2),
                c.lastPurchaseAt ? new Date(c.lastPurchaseAt).toLocaleString('es-CR') : '-',
              ]),
            )}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            Exportar CSV
          </button>
        </div>
        <div className="overflow-auto max-h-80">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Cliente</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Código</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Compras</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Total comprado</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Última compra</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {topCustomers.map((c) => (
                <tr key={c.customerId}>
                  <td className="px-4 py-2">{c.customerName}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{c.customerCode || '-'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{c.purchaseCount}</td>
                  <td className="px-4 py-2 font-semibold whitespace-nowrap">{formatCurrency(c.totalSpent, settings)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{c.lastPurchaseAt ? new Date(c.lastPurchaseAt).toLocaleString('es-CR') : '-'}</td>
                </tr>
              ))}
              {topCustomers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">Sin clientes con compras en el rango seleccionado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-gray-900">Descuentos por puntos aplicados</h2>
          <button
            onClick={() => downloadCsv(
              `reporte_descuento_puntos_${fileSuffix}.csv`,
              ['Fecha', 'Factura', 'Cliente', 'Codigo cliente', 'Puntos usados', 'Descuento aplicado'],
              pointsDiscountRows.map((inv) => [
                new Date(inv.createdAt).toLocaleString('es-CR'),
                inv.invoiceNumber,
                inv.customerName || inv.order?.customer?.name || 'Consumidor final',
                inv.order?.customer?.code || '-',
                Number(inv.order?.pointsUsed || 0),
                Number(inv.order?.pointsDiscount || 0).toFixed(2),
              ]),
            )}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            Exportar CSV
          </button>
        </div>
        <div className="overflow-auto max-h-80">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Fecha</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Factura</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Cliente</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Código</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Puntos usados</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Descuento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pointsDiscountRows.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-4 py-2 whitespace-nowrap">{new Date(inv.createdAt).toLocaleString('es-CR')}</td>
                  <td className="px-4 py-2 font-mono whitespace-nowrap">{inv.invoiceNumber}</td>
                  <td className="px-4 py-2">{inv.customerName || inv.order?.customer?.name || 'Consumidor final'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{inv.order?.customer?.code || '-'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{Number(inv.order?.pointsUsed || 0)}</td>
                  <td className="px-4 py-2 font-semibold whitespace-nowrap">{formatCurrency(Number(inv.order?.pointsDiscount || 0), settings)}</td>
                </tr>
              ))}
              {pointsDiscountRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">Sin descuentos por puntos en el rango seleccionado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-gray-900">Facturas emitidas</h2>
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setInvoiceFilter('all')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  invoiceFilter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => setInvoiceFilter('points')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  invoiceFilter === 'points' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Con puntos
              </button>
            </div>
          </div>
          <button
            onClick={() => downloadCsv(
              `reporte_facturas_${invoiceFilter}_${fileSuffix}.csv`,
              ['Fecha', 'Factura', 'Cliente', 'Método', 'Estado', 'Puntos usados', 'Descuento puntos', 'Subtotal', 'Impuestos', 'Total'],
              filteredInvoices.map((inv) => [
                new Date(inv.createdAt).toLocaleString('es-CR'),
                inv.invoiceNumber,
                inv.customerName || 'Consumidor final',
                labelPaymentMethod(inv.paymentMethod),
                inv.status || '-',
                Number(inv.order?.pointsUsed || 0),
                Number(inv.order?.pointsDiscount || 0).toFixed(2),
                Number(inv.subtotal || 0).toFixed(2),
                Number(inv.taxAmount || 0).toFixed(2),
                Number(inv.total || 0).toFixed(2),
              ]),
            )}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            Exportar CSV
          </button>
        </div>
        <div className="overflow-auto max-h-96">
          <table className="w-full min-w-[1120px] text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Fecha</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Factura</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Cliente</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Método</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Estado</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Puntos usados</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Desc. puntos</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Subtotal</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Impuestos</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredInvoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-4 py-2 whitespace-nowrap">{new Date(inv.createdAt).toLocaleString('es-CR')}</td>
                  <td className="px-4 py-2 font-mono whitespace-nowrap">{inv.invoiceNumber}</td>
                  <td className="px-4 py-2">{inv.customerName || 'Consumidor final'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{labelPaymentMethod(inv.paymentMethod)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{inv.status || '-'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{Number(inv.order?.pointsUsed || 0)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{formatCurrency(Number(inv.order?.pointsDiscount || 0), settings)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{formatCurrency(inv.subtotal || 0, settings)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{formatCurrency(inv.taxAmount || 0, settings)}</td>
                  <td className="px-4 py-2 font-semibold whitespace-nowrap">{formatCurrency(inv.total || 0, settings)}</td>
                </tr>
              ))}
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                    {invoiceFilter === 'points'
                      ? 'No hay facturas con descuento por puntos en el rango seleccionado.'
                      : 'Sin facturas en el rango seleccionado.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-gray-900">Ventas por categoría</h2>
          <button
            onClick={() => downloadCsv(
              `reporte_ventas_categoria_${fileSuffix}.csv`,
              ['Categoría', 'Órdenes', 'Unidades vendidas', 'Total', '% del total'],
              categorySales.map((row) => [
                row.categoryName,
                row.orderCount,
                row.totalQuantity,
                Number(row.totalRevenue).toFixed(2),
                `${row.percentage}%`,
              ]),
            )}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            Exportar CSV
          </button>
        </div>
        <div className="overflow-auto max-h-80">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Categoría</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Órdenes</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Unidades vendidas</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Total</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">% del total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categorySales.map((row) => (
                <tr key={row.categoryId}>
                  <td className="px-4 py-2 font-medium">{row.categoryName}</td>
                  <td className="px-4 py-2">{row.orderCount}</td>
                  <td className="px-4 py-2">{row.totalQuantity}</td>
                  <td className="px-4 py-2 font-semibold whitespace-nowrap">{formatCurrency(row.totalRevenue, settings)}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden min-w-[60px]">
                        <div
                          className="h-2 bg-brand-500 rounded-full"
                          style={{ width: `${row.percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 whitespace-nowrap">{row.percentage}%</span>
                    </div>
                  </td>
                </tr>
              ))}
              {categorySales.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">Sin ventas en el rango seleccionado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-emerald-500/10 border border-emerald-200 rounded-lg p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Entradas manuales</p>
          <p className="mt-1 text-2xl font-bold text-emerald-900">{formatCurrency(totalCashIn, settings)}</p>
        </div>
        <div className="bg-red-500/10 border border-red-200 rounded-lg p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Salidas manuales</p>
          <p className="mt-1 text-2xl font-bold text-red-900">{formatCurrency(totalCashOut, settings)}</p>
        </div>
        <div className="bg-slate-500/10 border border-slate-200 rounded-lg p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Turnos registrados</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{cashShifts.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-gray-900">Aperturas y cierres de caja</h2>
          <button
            onClick={() => downloadCsv(
              `reporte_cierres_caja_${fileSuffix}.csv`,
              ['Apertura', 'Cierre', 'Cajero apertura', 'Cajero cierre', 'Caja inicial', 'Caja esperada', 'Caja final', 'Diferencia'],
              cashShifts.map((row) => [
                new Date(row.openedAt).toLocaleString('es-CR'),
                row.closedAt ? new Date(row.closedAt).toLocaleString('es-CR') : 'Abierto',
                row.openedBy?.name || '-',
                row.closedBy?.name || '-',
                Number(row.openingCash || 0).toFixed(2),
                Number(row.expectedCash || 0).toFixed(2),
                Number(row.closingCash || 0).toFixed(2),
                Number(row.cashDifference || 0).toFixed(2),
              ]),
            )}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            Exportar CSV
          </button>
        </div>
        <div className="overflow-auto max-h-80">
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Apertura</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Cierre</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Cajero apertura</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Cajero cierre</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Inicial</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Esperada</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Final</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Diferencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cashShifts.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-2 whitespace-nowrap">{new Date(row.openedAt).toLocaleString('es-CR')}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{row.closedAt ? new Date(row.closedAt).toLocaleString('es-CR') : 'Abierto'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{row.openedBy?.name || '-'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{row.closedBy?.name || '-'}</td>
                  <td className="px-4 py-2 font-semibold whitespace-nowrap">{formatCurrency(row.openingCash || 0, settings)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{formatCurrency(row.expectedCash || 0, settings)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{formatCurrency(row.closingCash || 0, settings)}</td>
                  <td className={`px-4 py-2 font-semibold whitespace-nowrap ${Number(row.cashDifference || 0) === 0 ? 'text-gray-700' : Number(row.cashDifference || 0) > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {formatCurrency(row.cashDifference || 0, settings)}
                  </td>
                </tr>
              ))}
              {cashShifts.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">Sin turnos de caja en el rango seleccionado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-gray-900">Movimientos manuales de caja</h2>
          <button
            onClick={() => downloadCsv(
              `reporte_movimientos_caja_${fileSuffix}.csv`,
              ['Fecha', 'Turno', 'Tipo', 'Categoría', 'Monto', 'Motivo', 'Notas', 'Usuario'],
              cashMovements.map((row) => [
                new Date(row.createdAt).toLocaleString('es-CR'),
                row.shiftId,
                row.direction === 'IN' ? 'Entrada' : 'Salida',
                labelCashCategory(row.category),
                Number(row.amount || 0).toFixed(2),
                row.reason,
                row.notes || '',
                row.createdBy?.name || '-',
              ]),
            )}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            Exportar CSV
          </button>
        </div>
        <div className="overflow-auto max-h-80">
          <table className="w-full min-w-[1180px] text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Fecha</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Tipo</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Categoría</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Monto</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Motivo</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Notas</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Usuario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cashMovements.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-2 whitespace-nowrap">{new Date(row.createdAt).toLocaleString('es-CR')}</td>
                  <td className={`px-4 py-2 font-semibold whitespace-nowrap ${row.direction === 'IN' ? 'text-emerald-700' : 'text-red-700'}`}>
                    {row.direction === 'IN' ? 'Entrada' : 'Salida'}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">{labelCashCategory(row.category)}</td>
                  <td className={`px-4 py-2 font-semibold whitespace-nowrap ${row.direction === 'IN' ? 'text-emerald-700' : 'text-red-700'}`}>
                    {row.direction === 'IN' ? '+' : '-'}{formatCurrency(row.amount || 0, settings)}
                  </td>
                  <td className="px-4 py-2">{row.reason}</td>
                  <td className="px-4 py-2 text-gray-600">{row.notes || '-'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{row.createdBy?.name || '-'}</td>
                </tr>
              ))}
              {cashMovements.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">Sin movimientos manuales de caja en el rango seleccionado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-gray-900">Gastos del periodo</h2>
          <button
            onClick={() => downloadCsv(
              `reporte_gastos_${fileSuffix}.csv`,
              ['Fecha', 'Categoría', 'Descripción', 'Monto'],
              expenses.map((exp) => [
                dateOnly(exp.date),
                exp.category,
                exp.description,
                Number(exp.amount || 0).toFixed(2),
              ]),
            )}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            Exportar CSV
          </button>
        </div>
        <div className="overflow-auto max-h-80">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Fecha</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Categoría</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Descripción</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {expenses.map((exp) => (
                <tr key={exp.id}>
                  <td className="px-4 py-2 whitespace-nowrap">{dateOnly(exp.date)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{exp.category}</td>
                  <td className="px-4 py-2">{exp.description}</td>
                  <td className="px-4 py-2 font-semibold whitespace-nowrap">{formatCurrency(exp.amount || 0, settings)}</td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">Sin gastos en el rango seleccionado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
