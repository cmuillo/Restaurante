import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';
import { useActiveBranchId } from '../../../hooks/useActiveBranchId';
import { useSettings } from '../../../hooks/useSettings';
import { formatCurrency } from '../../../stores/settings.store';

type DateRange = 'week' | 'month' | 'custom';

type InvoiceItem = {
  id: string;
  invoiceNumber: string;
  paymentMethod?: string;
  status?: string;
  customerName?: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  createdAt: string;
};

type ExpenseItem = {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
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

function dateOnly(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CR');
}

export default function ReportsPage() {
  const branchId = useActiveBranchId();
  const settings = useSettings();

  const [dateRange, setDateRange] = useState<DateRange>('month');
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

  const paymentSummary = useMemo(() => {
    const map = new Map<string, { invoices: number; total: number }>();
    for (const inv of invoices) {
      const key = inv.paymentMethod || 'unknown';
      const current = map.get(key) ?? { invoices: 0, total: 0 };
      current.invoices += 1;
      current.total += Number(inv.total || 0);
      map.set(key, current);
    }
    return Array.from(map.entries())
      .map(([method, values]) => ({ method, ...values }))
      .sort((a, b) => b.total - a.total);
  }, [invoices]);

  const totalExpenses = useMemo(
    () => expenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0),
    [expenses],
  );

  const net = Number(salesRange?.total || 0) - totalExpenses;

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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Ventas facturadas</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(salesRange?.total || 0, settings)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Impuestos</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(salesRange?.tax || 0, settings)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Gastos</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalExpenses, settings)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Resultado neto</p>
          <p className={`text-2xl font-bold mt-1 ${net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            {formatCurrency(net, settings)}
          </p>
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
          <h2 className="font-semibold text-gray-900">Facturas emitidas</h2>
          <button
            onClick={() => downloadCsv(
              `reporte_facturas_${fileSuffix}.csv`,
              ['Fecha', 'Factura', 'Cliente', 'Método', 'Estado', 'Subtotal', 'Impuestos', 'Total'],
              invoices.map((inv) => [
                new Date(inv.createdAt).toLocaleString('es-CR'),
                inv.invoiceNumber,
                inv.customerName || 'Consumidor final',
                labelPaymentMethod(inv.paymentMethod),
                inv.status || '-',
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
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Fecha</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Factura</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Cliente</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Método</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Estado</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Subtotal</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Impuestos</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-4 py-2 whitespace-nowrap">{new Date(inv.createdAt).toLocaleString('es-CR')}</td>
                  <td className="px-4 py-2 font-mono whitespace-nowrap">{inv.invoiceNumber}</td>
                  <td className="px-4 py-2">{inv.customerName || 'Consumidor final'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{labelPaymentMethod(inv.paymentMethod)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{inv.status || '-'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{formatCurrency(inv.subtotal || 0, settings)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{formatCurrency(inv.taxAmount || 0, settings)}</td>
                  <td className="px-4 py-2 font-semibold whitespace-nowrap">{formatCurrency(inv.total || 0, settings)}</td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">Sin facturas en el rango seleccionado.</td>
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
