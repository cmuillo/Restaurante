import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { useActiveBranchId } from '../../../hooks/useActiveBranchId';
import { useSettings } from '../../../hooks/useSettings';
import { formatCurrency } from '../../../stores/settings.store';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Expense = {
  id: string;
  category: string;
  description: string;
  amount: number;
  ivaAmount: number;
  date: string;
  supplierName?: string;
  supplierTaxId?: string;
  receiptNumber?: string;
  receiptUrl?: string;
  paymentMethod?: string;
  isDeductible?: boolean;
  notes?: string;
  createdAt: string;
};

type CategorySummary = { category: string; total: string; totalIva: string };

// ─── Constantes ───────────────────────────────────────────────────────────────

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'SUPPLIES', label: 'Insumos / Materia prima' },
  { value: 'FOOD_COST', label: 'Costo de alimentos' },
  { value: 'PAYROLL', label: 'Planilla / Salarios' },
  { value: 'UTILITIES', label: 'Servicios (agua, luz, internet)' },
  { value: 'RENT', label: 'Alquiler' },
  { value: 'MAINTENANCE', label: 'Mantenimiento' },
  { value: 'MARKETING', label: 'Publicidad / Marketing' },
  { value: 'TAXES', label: 'Impuestos y tasas' },
  { value: 'INSURANCE', label: 'Seguros' },
  { value: 'OTHER', label: 'Otro' },
];

const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'check', label: 'Cheque' },
  { value: 'other', label: 'Otro' },
];

const CATEGORY_COLORS: Record<string, string> = {
  SUPPLIES: 'bg-blue-100 text-blue-700',
  FOOD_COST: 'bg-orange-100 text-orange-700',
  PAYROLL: 'bg-purple-100 text-purple-700',
  UTILITIES: 'bg-yellow-100 text-yellow-700',
  RENT: 'bg-red-100 text-red-700',
  MAINTENANCE: 'bg-gray-100 text-gray-700',
  MARKETING: 'bg-pink-100 text-pink-700',
  TAXES: 'bg-indigo-100 text-indigo-700',
  INSURANCE: 'bg-teal-100 text-teal-700',
  OTHER: 'bg-slate-100 text-slate-600',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function categoryLabel(value: string) {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

function paymentLabel(value?: string) {
  return PAYMENT_METHODS.find((p) => p.value === value)?.label ?? value ?? '—';
}

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

// ─── Parser XML Factura Electrónica Hacienda CR ───────────────────────────────
function parseHaciendaXML(xmlText: string): Partial<FormData> | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');
    if (doc.querySelector('parsererror')) return null;

    const getText = (tag: string) => {
      // Buscar con y sin namespace
      const el = doc.getElementsByTagNameNS('*', tag)[0] ?? doc.querySelector(tag);
      return el?.textContent?.trim() ?? '';
    };

    // Número de comprobante
    const clave = getText('Clave');
    const consecutivo = getText('NumeroConsecutivo');
    const receiptNumber = consecutivo || clave.slice(0, 50) || '';

    // Fecha (formato: 2026-04-15T12:00:00-06:00)
    const fechaRaw = getText('FechaEmision');
    const date = fechaRaw ? fechaRaw.slice(0, 10) : todayStr();

    // Emisor (proveedor)
    const emisorEl = doc.getElementsByTagNameNS('*', 'Emisor')[0];
    const supplierName = emisorEl?.getElementsByTagNameNS('*', 'Nombre')[0]?.textContent?.trim() ?? '';
    const supplierTaxId = emisorEl?.getElementsByTagNameNS('*', 'Numero')[0]?.textContent?.trim() ?? '';

    // Descripción: primera línea de detalle
    const primerDetalle = doc.getElementsByTagNameNS('*', 'Detalle')[0]?.textContent?.trim() ?? '';
    const description = primerDetalle.slice(0, 200) || `Factura ${receiptNumber}`;

    // Montos del resumen
    const resumen = doc.getElementsByTagNameNS('*', 'ResumenFactura')[0];
    const totalVenta = parseFloat(resumen?.getElementsByTagNameNS('*', 'TotalVentaNeta')[0]?.textContent ?? '0') || 0;
    const totalImpuesto = parseFloat(resumen?.getElementsByTagNameNS('*', 'TotalImpuesto')[0]?.textContent ?? '0') || 0;
    const totalComprobante = parseFloat(resumen?.getElementsByTagNameNS('*', 'TotalComprobante')[0]?.textContent ?? '0') || 0;

    // Si no hay totalVenta, calcular desde totalComprobante - totalImpuesto
    const amount = totalVenta > 0 ? totalVenta : (totalComprobante - totalImpuesto);

    return {
      receiptNumber,
      date,
      supplierName,
      supplierTaxId,
      description,
      amount: Math.max(0, amount),
      ivaAmount: totalImpuesto,
      isDeductible: true,
      paymentMethod: 'transfer',
    };
  } catch {
    return null;
  }
}

function todayStr() {
  return toDateInput(new Date());
}

function monthStartStr() {
  const d = new Date();
  d.setDate(1);
  return toDateInput(d);
}

// ─── Modal ────────────────────────────────────────────────────────────────────

type XmlParseState = 'idle' | 'ok' | 'error';

type FormData = Omit<Expense, 'id' | 'createdAt'>;

const EMPTY_FORM: FormData = {
  category: 'SUPPLIES',
  description: '',
  amount: 0,
  ivaAmount: 0,
  date: todayStr(),
  supplierName: '',
  supplierTaxId: '',
  receiptNumber: '',
  receiptUrl: '',
  paymentMethod: 'transfer',
  isDeductible: false,
  notes: '',
};

function ExpenseModal({
  initial,
  onClose,
  onSave,
  saving,
}: {
  initial: FormData;
  onClose: () => void;
  onSave: (data: FormData) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<FormData>(initial);
  const [xmlState, setXmlState] = useState<XmlParseState>('idle');
  const xmlInputRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof FormData, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const handleXmlUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseHaciendaXML(text);
      if (parsed) {
        setForm((f) => ({ ...f, ...parsed }));
        setXmlState('ok');
      } else {
        setXmlState('error');
      }
    };
    reader.readAsText(file, 'utf-8');
    // reset para permitir re-subir el mismo archivo
    e.target.value = '';
  };

  const totalWithIva = (Number(form.amount) || 0) + (Number(form.ivaAmount) || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-800">
            {initial === EMPTY_FORM ? 'Nuevo gasto' : 'Editar gasto'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Importar XML */}
          <div className={`rounded-lg border-2 border-dashed p-3 flex items-center gap-3 transition ${xmlState === 'ok' ? 'border-green-300 bg-green-50' : xmlState === 'error' ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
            <div className="text-2xl">{xmlState === 'ok' ? '✅' : xmlState === 'error' ? '❌' : '📄'}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-700">Importar XML de factura electrónica</p>
              <p className={`text-xs mt-0.5 ${xmlState === 'ok' ? 'text-green-600' : xmlState === 'error' ? 'text-red-500' : 'text-gray-400'}`}>
                {xmlState === 'ok' ? 'Datos cargados correctamente desde el XML del proveedor' : xmlState === 'error' ? 'No se pudo leer el XML — verifique que sea una factura electrónica de Hacienda CR' : 'Suba el XML que envía el proveedor para autocompletar el formulario'}
              </p>
            </div>
            <input ref={xmlInputRef} type="file" accept=".xml,text/xml,application/xml" className="hidden" onChange={handleXmlUpload} />
            <button
              type="button"
              onClick={() => xmlInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg bg-white border text-sm text-gray-600 hover:bg-gray-100 whitespace-nowrap flex-shrink-0"
            >
              Seleccionar XML
            </button>
          </div>
          {/* Fila 1 — Categoría + Fecha */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría *</label>
              <select
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción *</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Ej: Compra de verduras para cocina"
              maxLength={200}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Fila 2 — Monto + IVA */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto neto (₡) *</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.amount}
                onChange={(e) => set('amount', parseFloat(e.target.value) || 0)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IVA pagado (₡)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.ivaAmount}
                onChange={(e) => set('ivaAmount', parseFloat(e.target.value) || 0)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <p className="text-xs text-gray-400 mt-0.5">13% CR si aplica</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total con IVA</label>
              <div className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 font-semibold text-gray-700">
                ₡{totalWithIva.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Separador — Datos del proveedor */}
          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Datos del proveedor (requeridos para deducción fiscal)
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del proveedor</label>
                <input
                  type="text"
                  value={form.supplierName ?? ''}
                  onChange={(e) => set('supplierName', e.target.value)}
                  placeholder="Ej: Distribuidora El Sol S.A."
                  maxLength={150}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cédula jurídica / física</label>
                <input
                  type="text"
                  value={form.supplierTaxId ?? ''}
                  onChange={(e) => set('supplierTaxId', e.target.value)}
                  placeholder="3-101-123456"
                  maxLength={20}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>
          </div>

          {/* Comprobante + Método de pago */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">N.° comprobante electrónico</label>
              <input
                type="text"
                value={form.receiptNumber ?? ''}
                onChange={(e) => set('receiptNumber', e.target.value)}
                placeholder="Ej: CFE-0001-2026-0000123"
                maxLength={50}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Método de pago</label>
              <select
                value={form.paymentMethod ?? 'transfer'}
                onChange={(e) => set('paymentMethod', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {PAYMENT_METHODS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Deducible + Notas */}
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2 col-span-1 mt-5">
              <input
                id="deductible"
                type="checkbox"
                checked={form.isDeductible ?? false}
                onChange={(e) => set('isDeductible', e.target.checked)}
                className="h-4 w-4 accent-blue-600"
              />
              <label htmlFor="deductible" className="text-sm text-gray-700">Deducible fiscalmente</label>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas internas</label>
              <input
                type="text"
                value={form.notes ?? ''}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="Observaciones adicionales..."
                maxLength={500}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border text-sm text-gray-600 hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            disabled={saving || !form.description || !form.amount || !form.date}
            onClick={() => onSave(form)}
            className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const branchId = useActiveBranchId();
  const settings = useSettings();
  const qc = useQueryClient();

  const [tab, setTab] = useState<'list' | 'summary'>('list');
  const [from, setFrom] = useState(monthStartStr());
  const [to, setTo] = useState(todayStr());
  const [categoryFilter, setCategoryFilter] = useState('');
  const [deductibleFilter, setDeductibleFilter] = useState<'' | 'true' | 'false'>('');
  const [searchText, setSearchText] = useState('');
  const [modal, setModal] = useState<null | 'create' | Expense>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: expenses = [], isFetching } = useQuery<Expense[]>({
    queryKey: ['expenses', branchId, from, to],
    queryFn: () =>
      api.get(`/expenses?branchId=${branchId}&from=${from}&to=${to}`).then((r) => r.data),
    enabled: !!branchId,
  });

  const { data: summary = [] } = useQuery<CategorySummary[]>({
    queryKey: ['expenses-summary', branchId, from, to],
    queryFn: () =>
      api.get(`/expenses/summary?branchId=${branchId}&from=${from}&to=${to}`).then((r) => r.data),
    enabled: !!branchId && tab === 'summary',
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['expenses'] });
    qc.invalidateQueries({ queryKey: ['expenses-summary'] });
  };

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      api.post(`/expenses?branchId=${branchId}`, data).then((r) => r.data),
    onSuccess: () => { invalidate(); setModal(null); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FormData> }) =>
      api.patch(`/expenses/${id}?branchId=${branchId}`, data).then((r) => r.data),
    onSuccess: () => { invalidate(); setModal(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/expenses/${id}?branchId=${branchId}`),
    onSuccess: () => { invalidate(); setDeleteTarget(null); },
  });

  // ── Filtros locales ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (categoryFilter && e.category !== categoryFilter) return false;
      if (deductibleFilter === 'true' && !e.isDeductible) return false;
      if (deductibleFilter === 'false' && e.isDeductible) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        const match =
          e.description.toLowerCase().includes(q) ||
          (e.supplierName ?? '').toLowerCase().includes(q) ||
          (e.receiptNumber ?? '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [expenses, categoryFilter, deductibleFilter, searchText]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalNeto = filtered.reduce((s, e) => s + Number(e.amount), 0);
  const totalIva = filtered.reduce((s, e) => s + Number(e.ivaAmount), 0);
  const totalBruto = totalNeto + totalIva;
  const deductibles = filtered.filter((e) => e.isDeductible).reduce((s, e) => s + Number(e.amount), 0);

  // ── Quick presets ─────────────────────────────────────────────────────────
  const applyPreset = (preset: 'today' | 'month' | 'lastMonth' | 'year') => {
    const now = new Date();
    if (preset === 'today') { setFrom(todayStr()); setTo(todayStr()); }
    else if (preset === 'month') { const s = new Date(now.getFullYear(), now.getMonth(), 1); setFrom(toDateInput(s)); setTo(todayStr()); }
    else if (preset === 'lastMonth') {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      setFrom(toDateInput(s)); setTo(toDateInput(e));
    }
    else if (preset === 'year') { setFrom(`${now.getFullYear()}-01-01`); setTo(todayStr()); }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const fmt = (n: number) => formatCurrency(n, settings);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Gastos</h1>
          <p className="text-sm text-gray-500">Registro y control de gastos operativos</p>
        </div>
        <button
          onClick={() => setModal('create')}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
        >
          + Nuevo gasto
        </button>
      </div>

      {/* Filtros de fecha */}
      <div className="bg-white rounded-xl border p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Desde</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Hasta</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <div className="flex gap-2">
          {[['Hoy', 'today'], ['Este mes', 'month'], ['Mes anterior', 'lastMonth'], ['Este año', 'year']].map(([label, preset]) => (
            <button
              key={preset}
              onClick={() => applyPreset(preset as 'today' | 'month' | 'lastMonth' | 'year')}
              className="px-3 py-1.5 rounded-lg border text-xs text-gray-600 hover:bg-gray-50"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total bruto', value: fmt(totalBruto), color: 'text-red-600', sub: `${filtered.length} gastos` },
          { label: 'Monto neto', value: fmt(totalNeto), color: 'text-gray-700', sub: 'sin IVA' },
          { label: 'IVA pagado', value: fmt(totalIva), color: 'text-yellow-600', sub: '13% CR' },
          { label: 'Deducibles', value: fmt(deductibles), color: 'text-green-600', sub: 'para Hacienda' },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-gray-400">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(['list', 'summary'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tab === t ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t === 'list' ? 'Registro' : 'Resumen por categoría'}
          </button>
        ))}
      </div>

      {/* ── Tab: Lista ─────────────────────────────────────────────────────── */}
      {tab === 'list' && (
        <>
          {/* Filtros adicionales */}
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="Buscar por descripción, proveedor, comprobante…"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm w-72"
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="">Todas las categorías</option>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select
              value={deductibleFilter}
              onChange={(e) => setDeductibleFilter(e.target.value as '' | 'true' | 'false')}
              className="border rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="">Todos</option>
              <option value="true">Solo deducibles</option>
              <option value="false">No deducibles</option>
            </select>
          </div>

          {/* Tabla */}
          <div className="bg-white rounded-xl border overflow-x-auto">
            {isFetching && (
              <div className="text-center py-4 text-sm text-gray-400">Cargando…</div>
            )}
            {!isFetching && filtered.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <p className="text-4xl mb-2">🧾</p>
                <p className="text-sm">No hay gastos en este período.</p>
              </div>
            )}
            {filtered.length > 0 && (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">Fecha</th>
                    <th className="px-4 py-3 text-left">Categoría</th>
                    <th className="px-4 py-3 text-left">Descripción</th>
                    <th className="px-4 py-3 text-left">Proveedor</th>
                    <th className="px-4 py-3 text-left">Comprobante</th>
                    <th className="px-4 py-3 text-right">Neto</th>
                    <th className="px-4 py-3 text-right">IVA</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-center">Pago</th>
                    <th className="px-4 py-3 text-center">Deducible</th>
                    <th className="px-4 py-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">{e.date}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[e.category] ?? 'bg-gray-100 text-gray-600'}`}>
                          {categoryLabel(e.category)}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[180px] truncate" title={e.description}>{e.description}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {e.supplierName ? (
                          <div>
                            <div className="font-medium truncate max-w-[140px]" title={e.supplierName}>{e.supplierName}</div>
                            {e.supplierTaxId && <div className="text-xs text-gray-400">{e.supplierTaxId}</div>}
                          </div>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {e.receiptNumber ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-700">{fmt(Number(e.amount))}</td>
                      <td className="px-4 py-3 text-right text-yellow-600">{Number(e.ivaAmount) > 0 ? fmt(Number(e.ivaAmount)) : <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-800">{fmt(Number(e.amount) + Number(e.ivaAmount))}</td>
                      <td className="px-4 py-3 text-center text-xs text-gray-500">{paymentLabel(e.paymentMethod)}</td>
                      <td className="px-4 py-3 text-center">
                        {e.isDeductible
                          ? <span className="text-green-600 font-bold" title="Deducible fiscalmente">✓</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => setModal(e)}
                            className="text-blue-500 hover:text-blue-700 text-xs px-2 py-1 rounded border hover:bg-blue-50"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => setDeleteTarget(e)}
                            className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded border hover:bg-red-50"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 font-semibold text-gray-700 border-t">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-right text-xs text-gray-500">TOTALES ({filtered.length} registros)</td>
                    <td className="px-4 py-3 text-right">{fmt(totalNeto)}</td>
                    <td className="px-4 py-3 text-right text-yellow-600">{fmt(totalIva)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{fmt(totalBruto)}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </>
      )}

      {/* ── Tab: Resumen ───────────────────────────────────────────────────── */}
      {tab === 'summary' && (
        <div className="bg-white rounded-xl border overflow-hidden">
          {summary.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-2">📊</p>
              <p className="text-sm">Sin datos para el período seleccionado.</p>
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-6 py-3 text-left">Categoría</th>
                    <th className="px-6 py-3 text-right">Total neto</th>
                    <th className="px-6 py-3 text-right">IVA</th>
                    <th className="px-6 py-3 text-right">Total bruto</th>
                    <th className="px-6 py-3 text-right">% del total</th>
                    <th className="px-6 py-3 text-left">Participación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {summary.map((s) => {
                    const neto = Number(s.total);
                    const iva = Number(s.totalIva);
                    const bruto = neto + iva;
                    const pct = totalBruto > 0 ? (bruto / totalBruto) * 100 : 0;
                    return (
                      <tr key={s.category} className="hover:bg-gray-50">
                        <td className="px-6 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[s.category] ?? 'bg-gray-100 text-gray-600'}`}>
                            {categoryLabel(s.category)}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right text-gray-700 font-medium">{fmt(neto)}</td>
                        <td className="px-6 py-3 text-right text-yellow-600">{iva > 0 ? fmt(iva) : <span className="text-gray-300">—</span>}</td>
                        <td className="px-6 py-3 text-right font-bold text-gray-800">{fmt(bruto)}</td>
                        <td className="px-6 py-3 text-right text-gray-500">{pct.toFixed(1)}%</td>
                        <td className="px-6 py-3">
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full"
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 font-semibold border-t">
                  <tr>
                    <td className="px-6 py-3 text-gray-600">TOTAL</td>
                    <td className="px-6 py-3 text-right">{fmt(totalNeto)}</td>
                    <td className="px-6 py-3 text-right text-yellow-600">{fmt(totalIva)}</td>
                    <td className="px-6 py-3 text-right text-red-600">{fmt(totalBruto)}</td>
                    <td className="px-6 py-3 text-right">100%</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </>
          )}
        </div>
      )}

      {/* ── Modal crear / editar ──────────────────────────────────────────── */}
      {modal !== null && (
        <ExpenseModal
          initial={
            modal === 'create'
              ? EMPTY_FORM
              : {
                  category: modal.category,
                  description: modal.description,
                  amount: Number(modal.amount),
                  ivaAmount: Number(modal.ivaAmount),
                  date: modal.date,
                  supplierName: modal.supplierName ?? '',
                  supplierTaxId: modal.supplierTaxId ?? '',
                  receiptNumber: modal.receiptNumber ?? '',
                  receiptUrl: modal.receiptUrl ?? '',
                  paymentMethod: modal.paymentMethod ?? 'transfer',
                  isDeductible: modal.isDeductible ?? false,
                  notes: modal.notes ?? '',
                }
          }
          onClose={() => setModal(null)}
          saving={createMutation.isPending || updateMutation.isPending}
          onSave={(data) => {
            if (modal === 'create') {
              createMutation.mutate(data);
            } else {
              updateMutation.mutate({ id: (modal as Expense).id, data });
            }
          }}
        />
      )}

      {/* ── Confirmar eliminar ────────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold text-gray-800 mb-2">¿Eliminar gasto?</h3>
            <p className="text-sm text-gray-600 mb-1">
              <strong>{deleteTarget.description}</strong>
            </p>
            <p className="text-sm text-gray-500 mb-5">
              {fmt(Number(deleteTarget.amount) + Number(deleteTarget.ivaAmount))} · {deleteTarget.date}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg border text-sm text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
