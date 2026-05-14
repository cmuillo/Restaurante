import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api, { customAlert } from '../../../lib/api';
import { useActiveBranchId } from '../../../hooks/useActiveBranchId';
import { fmtMoney } from '../../../stores/settings.store';
import { BillingModal } from '../../pos/components/BillingModal';

// ─── Types ───────────────────────────────────────────────────────────────────

type QuotationStatus = 'draft' | 'sent' | 'invoiced' | 'expired';

interface QuotationItemRow {
  id?: string;
  productId?: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  taxRate: number;
  subtotal: number;
}

interface Quotation {
  id: string;
  quotationNumber: string;
  status: QuotationStatus;
  branchId: string;
  customerId?: string;
  customer?: { id: string; name: string; email?: string; code?: string; loyaltyPoints?: number };
  notes?: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  items: QuotationItemRow[];
  createdAt: string;
}

interface Customer {
  id: string;
  name: string;
  email?: string;
  code?: string;
  loyaltyPoints: number;
  isExempt: boolean;
  exemptDocNumber?: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  taxRate?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<QuotationStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  invoiced: 'Facturada',
  expired: 'Vencida',
};

const STATUS_COLORS: Record<QuotationStatus, string> = {
  draft: 'bg-gray-500/20 text-gray-300',
  sent: 'bg-blue-500/20 text-blue-300',
  invoiced: 'bg-green-500/20 text-green-300',
  expired: 'bg-red-500/20 text-red-300',
};

function StatusBadge({ status }: { status: QuotationStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status] ?? 'bg-gray-500/20 text-gray-300'}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function calcTotals(items: QuotationItemRow[], discountAmount: number, isExempt = false) {
  const subtotal = items.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0);
  const taxAmount = isExempt
    ? 0
    : items.reduce((acc, i) => acc + i.unitPrice * i.quantity * (i.taxRate / 100), 0);
  const total = subtotal + taxAmount - discountAmount;
  return { subtotal, taxAmount, total };
}

// ─── Quotation Modal (create / edit) ─────────────────────────────────────────

interface QuotationModalProps {
  branchId: string;
  quotation?: Quotation | null;
  onClose: () => void;
  onSaved: () => void;
}

function QuotationModal({ branchId, quotation, onClose, onSaved }: QuotationModalProps) {
  const isEdit = !!quotation;

  const [customerId, setCustomerId] = useState(quotation?.customerId ?? '');
  const [customerSearch, setCustomerSearch] = useState(quotation?.customer?.name ?? '');
  const [isCustomerExempt, setIsCustomerExempt] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [items, setItems] = useState<QuotationItemRow[]>(
    quotation?.items?.map((i) => ({ ...i })) ?? [],
  );
  const [discountAmount, setDiscountAmount] = useState(Number(quotation?.discountAmount ?? 0));
  const [notes, setNotes] = useState(quotation?.notes ?? '');
  const [saving, setSaving] = useState(false);

  // Customers search
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers-search', customerSearch],
    queryFn: () =>
      api.get('/customers', { params: { search: customerSearch, isActive: true } }).then((r) => r.data),
    enabled: showCustomerDropdown,
  });

  // Products search
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products', branchId],
    queryFn: () =>
      api.get('/menu/products', { params: { branchId } }).then((r) => r.data),
  });

  const filteredProducts = useMemo(
    () =>
      products.filter((p) =>
        productSearch.trim() === '' || p.name.toLowerCase().includes(productSearch.toLowerCase()),
      ),
    [products, productSearch],
  );

  const { subtotal, taxAmount, total } = useMemo(
    () => calcTotals(items, discountAmount, isCustomerExempt),
    [items, discountAmount, isCustomerExempt],
  );

  function addProduct(product: Product) {
    const existing = items.findIndex((i) => i.productId === product.id);
    if (existing >= 0) {
      const updated = [...items];
      updated[existing].quantity += 1;
      updated[existing].subtotal = updated[existing].unitPrice * updated[existing].quantity;
      setItems(updated);
    } else {
      const taxRate = isCustomerExempt ? 0 : (product.taxRate ?? 13);
      setItems((prev) => [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          unitPrice: product.price,
          quantity: 1,
          taxRate,
          subtotal: product.price,
        },
      ]);
    }
    setProductSearch('');
    setShowProductDropdown(false);
  }

  function updateItem(index: number, field: 'quantity' | 'unitPrice', value: number) {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value, subtotal: 0 };
    updated[index].subtotal = updated[index].unitPrice * updated[index].quantity;
    setItems(updated);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (items.length === 0) {
      customAlert('Agrega al menos un producto a la cotización');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        branchId,
        customerId: customerId || undefined,
        items: items.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          unitPrice: i.unitPrice,
          quantity: i.quantity,
          taxRate: isCustomerExempt ? 0 : i.taxRate,
        })),
        discountAmount,
        notes: notes || undefined,
      };

      if (isEdit) {
        await api.patch(`/quotations/${quotation!.id}`, payload);
      } else {
        await api.post('/quotations', payload);
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[var(--color-bg-secondary,#1e2435)] border border-white/10 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-400 text-lg">
            📝
          </div>
          <h3 className="text-base font-semibold text-white flex-1">
            {isEdit ? `Editar ${quotation!.quotationNumber}` : 'Nueva Cotización'}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors text-lg"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Cliente */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Cliente</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar cliente..."
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setShowCustomerDropdown(true);
                  if (!e.target.value) { setCustomerId(''); }
                }}
                onFocus={() => setShowCustomerDropdown(true)}
                onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
              />
              {showCustomerDropdown && customers.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-10 bg-[#1e2435] border border-white/10 rounded-lg shadow-xl mt-1 max-h-48 overflow-y-auto">
                  <button
                    className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-white/5"
                    onMouseDown={() => { setCustomerSearch(''); setCustomerId(''); setIsCustomerExempt(false); setShowCustomerDropdown(false); }}
                  >
                    Sin cliente
                  </button>
                  {customers.map((c) => (
                    <button
                      key={c.id}
                      className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/5"
                      onMouseDown={() => {
                        setCustomerId(c.id);
                        setCustomerSearch(c.name);
                        setIsCustomerExempt(c.isExempt ?? false);
                        setShowCustomerDropdown(false);
                      }}
                    >
                      <span className="font-medium">{c.name}</span>
                      {c.email && <span className="ml-2 text-gray-400 text-xs">{c.email}</span>}
                      {c.isExempt && <span className="ml-2 text-xs bg-amber-500/20 text-amber-300 rounded px-1">Exonerado</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {isCustomerExempt && (
              <div className="mt-2 flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                <span className="text-amber-400 text-sm">⚠</span>
                <p className="text-xs text-amber-300">
                  <strong>Cliente exonerado de IVA</strong> — El impuesto se aplicará en 0% en esta cotización.
                </p>
              </div>
            )}
          </div>

          {/* Agregar productos */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Agregar producto</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar producto..."
                value={productSearch}
                onChange={(e) => { setProductSearch(e.target.value); setShowProductDropdown(true); }}
                onFocus={() => setShowProductDropdown(true)}
                onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
              />
              {showProductDropdown && filteredProducts.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-10 bg-[#1e2435] border border-white/10 rounded-lg shadow-xl mt-1 max-h-52 overflow-y-auto">
                  {filteredProducts.slice(0, 30).map((p) => (
                    <button
                      key={p.id}
                      className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/5 flex justify-between"
                      onMouseDown={() => addProduct(p)}
                    >
                      <span>{p.name}</span>
                      <span className="text-orange-400 text-xs">{fmtMoney(p.price)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tabla de items */}
          {items.length > 0 && (
            <div className="rounded-xl border border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-white/5">
                  <tr>
                    <th className="text-left px-3 py-2 text-gray-400 font-medium">Producto</th>
                    <th className="text-center px-3 py-2 text-gray-400 font-medium w-20">Cant.</th>
                    <th className="text-right px-3 py-2 text-gray-400 font-medium w-28">P. Unit.</th>
                    <th className="text-right px-3 py-2 text-gray-400 font-medium w-12">IVA%</th>
                    <th className="text-right px-3 py-2 text-gray-400 font-medium w-28">Subtotal</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="border-t border-white/5">
                      <td className="px-3 py-2 text-white">{item.productName}</td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, 'quantity', Math.max(1, Number(e.target.value)))}
                          className="w-16 bg-white/5 border border-white/10 rounded px-2 py-1 text-center text-white text-xs focus:outline-none focus:border-orange-500/50"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.unitPrice}
                          onChange={(e) => updateItem(idx, 'unitPrice', Number(e.target.value))}
                          className="w-24 bg-white/5 border border-white/10 rounded px-2 py-1 text-right text-white text-xs focus:outline-none focus:border-orange-500/50"
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-gray-400 text-xs">{item.taxRate}%</td>
                      <td className="px-3 py-2 text-right text-white">{fmtMoney(item.unitPrice * item.quantity)}</td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => removeItem(idx)}
                          className="text-gray-500 hover:text-red-400 transition-colors text-base leading-none"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Descuento y Notas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Descuento global (₡)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={discountAmount}
                onChange={(e) => setDiscountAmount(Math.max(0, Number(e.target.value)))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Notas adicionales</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Condiciones, vigencia, etc."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50 resize-none"
              />
            </div>
          </div>

          {/* Totales */}
          <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 space-y-1">
            <div className="flex justify-between text-sm text-gray-400">
              <span>Subtotal</span><span>{fmtMoney(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-400">
              <span>IVA</span>
              <span className={isCustomerExempt ? 'text-amber-400' : ''}>
                {isCustomerExempt ? '₡0.00 (Exonerado)' : fmtMoney(taxAmount)}
              </span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm text-red-400">
                <span>Descuento</span><span>-{fmtMoney(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold text-white border-t border-white/10 pt-2 mt-2">
              <span>Total</span><span>{fmtMoney(total)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg text-sm font-medium bg-orange-600 hover:bg-orange-500 text-white disabled:opacity-50 transition-colors"
          >
            {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear cotización'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function QuotationsPage() {
  const qc = useQueryClient();
  const branchId = useActiveBranchId();

  const [showModal, setShowModal] = useState(false);
  const [editQuotation, setEditQuotation] = useState<Quotation | null>(null);
  const [billingOrder, setBillingOrder] = useState<any | null>(null);
  const [billingCustomer, setBillingCustomer] = useState<any | null>(null);
  const [creatingOrderId, setCreatingOrderId] = useState<string | null>(null);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<QuotationStatus | 'all'>('all');

  const { data: quotations = [], isLoading } = useQuery<Quotation[]>({
    queryKey: ['quotations', branchId],
    queryFn: () => api.get('/quotations', { params: { branchId } }).then((r) => r.data),
    enabled: !!branchId,
  });

  const filteredQuotations = useMemo(
    () =>
      statusFilter === 'all'
        ? quotations
        : quotations.filter((q) => q.status === statusFilter),
    [quotations, statusFilter],
  );

  function openCreate() {
    setEditQuotation(null);
    setShowModal(true);
  }

  function openEdit(q: Quotation) {
    setEditQuotation(q);
    setShowModal(true);
  }

  function handleSaved() {
    qc.invalidateQueries({ queryKey: ['quotations', branchId] });
    setShowModal(false);
    setEditQuotation(null);
  }

  async function handleSendEmail(q: Quotation) {
    if (!q.customer?.email) {
      customAlert('El cliente no tiene correo electrónico registrado');
      return;
    }
    setSendingEmailId(q.id);
    try {
      await api.post(`/quotations/${q.id}/send-email`);
      qc.invalidateQueries({ queryKey: ['quotations', branchId] });
      customAlert(`Cotización enviada a ${q.customer.email}`);
    } finally {
      setSendingEmailId(null);
    }
  }

  async function handleInvoice(q: Quotation) {
    setCreatingOrderId(q.id);
    try {
      const { data: order } = await api.post(`/quotations/${q.id}/create-order`);
      qc.invalidateQueries({ queryKey: ['quotations', branchId] });
      setBillingCustomer(order.customer ?? null);
      setBillingOrder(order);
    } finally {
      setCreatingOrderId(null);
    }
  }

  function handleBillingClose() {
    setBillingOrder(null);
    setBillingCustomer(null);
    qc.invalidateQueries({ queryKey: ['quotations', branchId] });
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Cotizaciones</h1>
          <p className="text-gray-400 text-sm mt-1">{filteredQuotations.length} cotización(es)</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <span>+</span> Nueva Cotización
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        {(['all', 'draft', 'sent', 'invoiced', 'expired'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-orange-600 text-white'
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {s === 'all' ? 'Todas' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[var(--color-bg-secondary,#1e2435)] rounded-2xl border border-white/10 overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-gray-500">Cargando cotizaciones...</div>
        ) : filteredQuotations.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-gray-400 text-lg">No hay cotizaciones</p>
            <p className="text-gray-600 text-sm mt-1">Crea la primera con el botón de arriba</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Número</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Cliente</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Fecha</th>
                  <th className="text-right px-4 py-3 text-gray-400 font-medium">Subtotal</th>
                  <th className="text-right px-4 py-3 text-gray-400 font-medium">Descuento</th>
                  <th className="text-right px-4 py-3 text-gray-400 font-medium">Total</th>
                  <th className="text-center px-4 py-3 text-gray-400 font-medium">Estado</th>
                  <th className="text-center px-4 py-3 text-gray-400 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredQuotations.map((q) => (
                  <tr key={q.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-white font-mono font-medium">{q.quotationNumber}</td>
                    <td className="px-4 py-3 text-white">
                      {q.customer?.name ?? <span className="text-gray-600 italic">Sin cliente</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(q.createdAt).toLocaleDateString('es-CR')}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">{fmtMoney(Number(q.subtotal))}</td>
                    <td className="px-4 py-3 text-right text-red-400">
                      {Number(q.discountAmount) > 0 ? `-${fmtMoney(Number(q.discountAmount))}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-white font-medium">{fmtMoney(Number(q.total))}</td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={q.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        {/* Editar */}
                        {q.status !== 'invoiced' && (
                          <button
                            onClick={() => openEdit(q)}
                            title="Editar cotización"
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors text-base"
                          >
                            ✏️
                          </button>
                        )}

                        {/* Enviar email */}
                        {q.customer?.email && q.status !== 'invoiced' && (
                          <button
                            onClick={() => handleSendEmail(q)}
                            disabled={sendingEmailId === q.id}
                            title="Enviar por correo"
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors text-base disabled:opacity-50"
                          >
                            {sendingEmailId === q.id ? '⏳' : '📧'}
                          </button>
                        )}

                        {/* Facturar */}
                        {q.status !== 'invoiced' && (
                          <button
                            onClick={() => handleInvoice(q)}
                            disabled={creatingOrderId === q.id}
                            title="Facturar cotización"
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-green-400 hover:bg-green-500/10 transition-colors text-base disabled:opacity-50"
                          >
                            {creatingOrderId === q.id ? '⏳' : '💳'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal crear/editar */}
      {showModal && (
        <QuotationModal
          branchId={branchId}
          quotation={editQuotation}
          onClose={() => { setShowModal(false); setEditQuotation(null); }}
          onSaved={handleSaved}
        />
      )}

      {/* BillingModal para facturar la cotización */}
      {billingOrder && (
        <BillingModal
          isOpen={true}
          branchId={branchId}
          order={billingOrder}
          customer={billingCustomer}
          onClose={handleBillingClose}
        />
      )}
    </div>
  );
}
