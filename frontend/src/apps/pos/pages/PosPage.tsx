import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import jsQR from 'jsqr';
import api from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth.store';
import { useSettings } from '../../../hooks/useSettings';
import { fmtMoney, formatCurrency } from '../../../stores/settings.store';
import { BillingModal } from '../components/BillingModal';
import { FacturingStatusIndicator } from '../components/FacturingStatusIndicator';

interface CartItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  taxRate: number;
}

interface PendingOrderItem {
  id: string;
  productName: string;
  quantity: number;
  subtotal: number;
}

interface PendingOrder {
  id: string;
  orderNumber: number;
  type: 'dine_in' | 'takeout' | 'delivery' | 'kiosk';
  userId?: string | null;
  status: 'pending' | 'in_preparation' | 'ready' | 'delivered' | 'completed' | 'cancelled';
  subtotal: number;
  taxAmount: number;
  tipAmount: number;
  discountAmount: number;
  total: number;
  createdAt: string;
  table?: { number: number };
  customer?: {
    id: string;
    name: string;
    code: string;
    email?: string;
    loyaltyPoints: number;
  } | null;
  invoice?: { id: string } | null;
  items: PendingOrderItem[];
}

type UiOrderType = 'DINE_IN' | 'TO_GO' | 'DELIVERY';
type MobileSection = 'orders' | 'billing';

const ORDER_TYPE_TO_API: Record<UiOrderType, 'dine_in' | 'takeout' | 'delivery'> = {
  DINE_IN: 'dine_in',
  TO_GO: 'takeout',
  DELIVERY: 'delivery',
};

interface PosTable {
  id: string;
  number: number;
  status: string;
}

interface Branch {
  id: string;
  name: string;
}

interface Customer {
  id: string;
  name: string;
  code: string;
  email?: string;
  phone?: string;
  loyaltyPoints: number;
}

interface InvoiceHistoryItem {
  id: string;
  invoiceNumber: string;
  paymentMethod: 'cash' | 'card' | 'transfer' | 'qr' | 'mixed';
  status: 'issued' | 'cancelled' | 'credit_note';
  customerName?: string;
  subtotal: number;
  taxAmount: number;
  tipAmount: number;
  discountAmount: number;
  total: number;
  cashReceived: number;
  change: number;
  createdAt: string;
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
}

interface PosShift {
  id: string;
  status: 'OPEN' | 'CLOSED';
  openingCash: number;
  expectedCash?: number | null;
  openedAt: string;
  openedBy?: { name?: string } | null;
}

interface CashMovementItem {
  id: string;
  shiftId: string;
  direction: 'IN' | 'OUT';
  category: 'CHANGE' | 'PETTY_CASH' | 'REPLENISHMENT' | 'WITHDRAWAL' | 'DEPOSIT' | 'ADJUSTMENT' | 'OTHER';
  amount: number;
  reason: string;
  notes?: string;
  createdAt: string;
  createdBy?: { id?: string; name?: string } | null;
}

interface CashState {
  shift: PosShift | null;
  movements: CashMovementItem[];
  totals: {
    openingCash: number;
    cashSales: number;
    cardSales: number;
    totalCashIn: number;
    totalCashOut: number;
    expectedCash: number;
  } | null;
}

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
  if (value === 'sinpe') return 'SINPE Móvil';
  return 'No indicado';
}

function formatCashCategory(value: CashMovementItem['category']): string {
  if (value === 'CHANGE') return 'Cambio';
  if (value === 'PETTY_CASH') return 'Caja chica';
  if (value === 'REPLENISHMENT') return 'Reposicion';
  if (value === 'WITHDRAWAL') return 'Retiro';
  if (value === 'DEPOSIT') return 'Deposito';
  if (value === 'ADJUSTMENT') return 'Ajuste';
  return 'Otro';
}

function printHistoryInvoice(invoice: InvoiceHistoryItem) {
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
    .map((item) => {
      const lineSubtotal = toAmount(item.subtotal);
      const qty = toAmount(item.quantity);
      const unitPrice = qty > 0 ? toAmount(item.unitPrice) : 0;
      return `
        <tr>
          <td>${item.productName}</td>
          <td class="num">${qty}</td>
          <td class="num">${fmtMoney(unitPrice)}</td>
          <td class="num">${fmtMoney(lineSubtotal)}</td>
        </tr>
      `;
    })
    .join('');

  const html = `
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Factura ${invoice.invoiceNumber}</title>
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
    <h2 style="margin: 0;">${order?.branch?.name || 'Factura POS'}</h2>
    <div class="row"><span>Factura:</span><strong>${invoice.invoiceNumber}</strong></div>
    <div class="row"><span>Fecha:</span><strong>${new Date(invoice.createdAt).toLocaleString()}</strong></div>
    <div class="row"><span>Orden:</span><strong>#${order?.orderNumber || '-'}</strong></div>
    <div class="row"><span>Origen:</span><strong>${sourceLabel}</strong></div>
    <div class="row"><span>Cliente:</span><strong>${invoice.customerName || order?.customer?.name || 'Consumidor final'}</strong></div>
    <div class="row"><span>Método pago:</span><strong>${formatPaymentMethod(invoice.paymentMethod)}</strong></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Producto</th>
        <th class="num">Cant.</th>
        <th class="num">P. Unit</th>
        <th class="num">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="4" style="text-align:center">Sin detalle de ítems</td></tr>'}
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

  const w = window.open('', '_blank', 'width=900,height=900');
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

export default function PosPage() {
  const { user, logout } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin';
  const canManageShift = ['super_admin', 'branch_admin', 'cashier'].includes(user?.role ?? '');
  const initialQueryBranchId = new URLSearchParams(window.location.search).get('branchId') ?? '';
  const [selectedBranchId, setSelectedBranchId] = useState(initialQueryBranchId);
  const branchId = isSuperAdmin ? (selectedBranchId || user?.branchId || '') : (user?.branchId ?? '');
  const qc = useQueryClient();
  const settings = useSettings();

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<UiOrderType>('DINE_IN');
  const [tableId, setTableId] = useState('');
  const [kitchenNote, setKitchenNote] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showBilling, setShowBilling] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PendingOrder | null>(null);
  const [billingInitialStep, setBillingInitialStep] = useState<'payment' | 'cancelling'>('payment');
  const [billingTab, setBillingTab] = useState<'pending' | 'history'>('pending');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [mobileSection, setMobileSection] = useState<MobileSection>('orders');
  const [customerSearchCode, setCustomerSearchCode] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [qrStatus, setQrStatus] = useState<'idle' | 'starting' | 'scanning' | 'found' | 'error'>('idle');
  const [detectedQrCode, setDetectedQrCode] = useState('');
  const [shiftModalMode, setShiftModalMode] = useState<'open' | 'close' | null>(null);
  const [openingCashInput, setOpeningCashInput] = useState('0');
  const [closingCashInput, setClosingCashInput] = useState('0');
  const [closingNotesInput, setClosingNotesInput] = useState('');
  const [shiftError, setShiftError] = useState('');
  const [cashMovementModalOpen, setCashMovementModalOpen] = useState(false);
  const [cashMovementError, setCashMovementError] = useState('');
  const [cashMovementDirection, setCashMovementDirection] = useState<'IN' | 'OUT'>('OUT');
  const [cashMovementCategory, setCashMovementCategory] = useState<CashMovementItem['category']>('PETTY_CASH');
  const [cashMovementAmount, setCashMovementAmount] = useState('0');
  const [cashMovementReason, setCashMovementReason] = useState('');
  const [cashMovementNotes, setCashMovementNotes] = useState('');
  const [tablesModalOpen, setTablesModalOpen] = useState(false);
  const todayDate = toDateInputValue(new Date());

  // Camera QR scanning states
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ['pos-branches'],
    queryFn: () => api.get('/branches').then((r) => r.data),
    enabled: isSuperAdmin,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!isSuperAdmin || selectedBranchId) return;
    if (user?.branchId) {
      setSelectedBranchId(user.branchId);
      return;
    }
    if (branches.length > 0) {
      setSelectedBranchId(branches[0].id);
    }
  }, [isSuperAdmin, selectedBranchId, user?.branchId, branches]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const params = new URLSearchParams(window.location.search);
    if (branchId) params.set('branchId', branchId);
    else params.delete('branchId');
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', nextUrl);
  }, [isSuperAdmin, branchId]);

  const { data: categories = [] } = useQuery({
    queryKey: ['pos-categories', branchId],
    queryFn: () => api.get(`/menu/categories?branchId=${branchId}`).then((r) => r.data),
    enabled: !!branchId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['pos-products', branchId, activeCategory],
    queryFn: () =>
      api
        .get(`/menu/products?branchId=${branchId}${activeCategory ? `&categoryId=${activeCategory}` : ''}`)
        .then((r) => r.data),
    enabled: !!branchId,
  });

  const { data: tables = [] } = useQuery<PosTable[]>({
    queryKey: ['pos-tables', branchId],
    queryFn: () => api.get(`/tables?branchId=${branchId}`).then((r) => r.data),
    enabled: !!branchId && orderType === 'DINE_IN',
  });

  const { data: kioskMenuConfig } = useQuery<{ branchConfig?: { taxPercentage?: number } } | null>({
    queryKey: ['pos-tax-config', branchId],
    queryFn: () =>
      api
        .get(`/kiosk/${branchId}/menu`)
        .then((r) => r.data)
        .catch(() => null),
    enabled: !!branchId,
    staleTime: 5 * 60_000,
  });

  const { data: currentShift, isLoading: currentShiftLoading } = useQuery<PosShift | null>({
    queryKey: ['pos-current-shift', branchId],
    queryFn: () => api.get(`/pos/shift/current?branchId=${branchId}`).then((r) => r.data).catch(() => null),
    enabled: !!branchId && canManageShift,
    refetchInterval: 15_000,
  });

  const { data: cashState } = useQuery<CashState>({
    queryKey: ['pos-cash-state', branchId],
    queryFn: () => api.get(`/pos/cash-movements?branchId=${branchId}`).then((r) => r.data),
    enabled: !!branchId && canManageShift,
    refetchInterval: 15_000,
  });

  const { data: pendingOrders = [], isLoading: pendingOrdersLoading } = useQuery<PendingOrder[]>({
    queryKey: ['pos-pending-billing', branchId],
    queryFn: () =>
      api
        .get(`/orders?branchId=${branchId}`)
        .then((r) => r.data)
        .then((orders: PendingOrder[]) =>
          orders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled' && !o.invoice),
        ),
    enabled: !!branchId,
    refetchInterval: 15000,
  });

  const { data: invoicesHistory = [], isLoading: invoicesHistoryLoading } = useQuery<InvoiceHistoryItem[]>({
    queryKey: ['pos-invoices-history', branchId, todayDate],
    queryFn: () => api.get(`/billing/invoices?branchId=${branchId}&from=${todayDate}&to=${todayDate}`).then((r) => r.data),
    enabled: !!branchId,
    refetchInterval: 30000,
  });

  const updateTableStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/tables/${id}/status?branchId=${branchId}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos-tables', branchId] });
    },
  });

  const filteredInvoices = invoicesHistory.filter((inv) => {
    const query = invoiceSearch.trim().toLowerCase();
    if (!query) return true;
    return [
      inv.invoiceNumber,
      String(inv.order?.orderNumber || ''),
      inv.customerName || '',
      inv.order?.customer?.name || '',
      inv.order?.customer?.code || '',
    ].some((value) => String(value).toLowerCase().includes(query));
  });

  const freeTables = tables.filter((t) => String(t.status).toLowerCase() === 'free');

  const searchCustomer = useMutation({
    mutationFn: async (code: string) => {
      if (!code.trim()) return null;
      return api.get(`/customers/code/${code}`).then((r) => r.data);
    },
    onSuccess: (data) => {
      if (data) {
        setSelectedCustomer(data);
        setCustomerSearchCode('');
      }
    },
  });

  // QR Camera scanning functions
  const startCamera = async () => {
    setCameraModalOpen(true);
    try {
      setQrStatus('starting');
      setDetectedQrCode('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setCameraActive(true);
    } catch (err) {
      console.error('Error accessing camera:', err);
      setCameraActive(false);
      setQrStatus('error');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setCameraActive(false);
    setCameraModalOpen(false);
    setQrStatus('idle');
  };

  const scanQRCode = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scanFrame = () => {
      if (!streamRef.current || video.readyState < 2 || !video.videoWidth) {
        animationFrameRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code) {
        const qrData = code.data;
        setDetectedQrCode(qrData);
        setQrStatus('found');
        setCustomerSearchCode(qrData);
        searchCustomer.mutate(qrData);
        stopCamera();
        return;
      }

      animationFrameRef.current = requestAnimationFrame(scanFrame);
    };

    animationFrameRef.current = requestAnimationFrame(scanFrame);
  };

  // Conecta stream al video cuando el modal ya esta montado
  useEffect(() => {
    if (!cameraActive || !videoRef.current || !streamRef.current) return;

    const video = videoRef.current;
    video.srcObject = streamRef.current;
    video.muted = true;

    video
      .play()
      .then(() => {
        setQrStatus('scanning');
        scanQRCode();
      })
      .catch((err) => {
        console.error('Error reproduciendo video de camara:', err);
        setQrStatus('error');
      });
  }, [cameraActive]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const addToCart = (product: { id: string; name: string; price: number; taxRate?: number }) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [
        ...prev,
        { productId: product.id, productName: product.name, price: product.price, quantity: 1, taxRate: product.taxRate ?? 0 },
      ];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => {
      const item = prev.find((i) => i.productId === productId);
      if (!item) return prev;
      if (item.quantity <= 1) return prev.filter((i) => i.productId !== productId);
      return prev.map((i) =>
        i.productId === productId ? { ...i, quantity: i.quantity - 1 } : i,
      );
    });
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const taxAmount = cart.reduce((sum, item) => sum + item.price * item.quantity * (item.taxRate / 100), 0);
  const taxPercentage = Number(kioskMenuConfig?.branchConfig?.taxPercentage ?? 0); // fallback para el API
  const totalWithTax = subtotal + taxAmount;
  const missingRequiredTable = orderType === 'DINE_IN' && !tableId;

  const placeOrder = useMutation({
    mutationFn: () =>
      api
        .post('/orders', {
          branchId,
          customerId: selectedCustomer?.id || undefined,
          type: ORDER_TYPE_TO_API[orderType],
          tableId: orderType === 'DINE_IN' && tableId ? tableId : undefined,
          notes: kitchenNote.trim() ? kitchenNote.trim() : undefined,
          taxPercentage,
          tipPercentage: 0,
          discountAmount: 0,
          items: cart.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            unitPrice: item.price,
            quantity: item.quantity,
            notes: kitchenNote.trim() ? kitchenNote.trim() : undefined,
            modifiers: [],
          })),
        })
        .then((r) => r.data),
    onSuccess: () => {
      setCart([]);
      setTableId('');
      setKitchenNote('');
      setSelectedCustomer(null);
      setSuccessMsg('Orden enviada a cocina. Lista para facturacion cuando corresponda.');
      setTimeout(() => setSuccessMsg(''), 3000);
      qc.invalidateQueries({ queryKey: ['pos-tables'] });
      qc.invalidateQueries({ queryKey: ['pos-pending-billing'] });
    },
  });

  const openBillingForOrder = (order: PendingOrder) => {
    setBillingInitialStep('payment');
    setSelectedOrder(order);
    setShowBilling(true);
  };

  const openCancelForOrder = (order: PendingOrder) => {
    setBillingInitialStep('cancelling');
    setSelectedOrder(order);
    setShowBilling(true);
  };

  const openShift = useMutation({
    mutationFn: (openingCash: number) =>
      api.post(`/pos/shift/open?branchId=${branchId}`, { openingCash }, { headers: { 'X-Silent-Error': '1' } }).then((r) => r.data),
    onSuccess: () => {
      setShiftError('');
      setSuccessMsg('Caja abierta correctamente.');
      setTimeout(() => setSuccessMsg(''), 2500);
      setShiftModalMode(null);
      qc.invalidateQueries({ queryKey: ['pos-current-shift', branchId] });
      qc.invalidateQueries({ queryKey: ['pos-cash-state', branchId] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      setShiftError(Array.isArray(msg) ? msg.join(' · ') : String(msg ?? 'No se pudo abrir la caja.'));
    },
  });

  const closeShift = useMutation({
    mutationFn: (payload: { closingCash: number; closingNotes?: string }) =>
      api.post(`/pos/shift/close?branchId=${branchId}`, payload, { headers: { 'X-Silent-Error': '1' } }).then((r) => r.data),
    onSuccess: () => {
      setShiftError('');
      setSuccessMsg('Caja cerrada correctamente.');
      setTimeout(() => setSuccessMsg(''), 2500);
      setShiftModalMode(null);
      qc.invalidateQueries({ queryKey: ['pos-current-shift', branchId] });
      qc.invalidateQueries({ queryKey: ['pos-cash-state', branchId] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      setShiftError(Array.isArray(msg) ? msg.join(' · ') : String(msg ?? 'No se pudo cerrar la caja.'));
    },
  });

  const createCashMovement = useMutation({
    mutationFn: (payload: { direction: 'IN' | 'OUT'; category: CashMovementItem['category']; amount: number; reason: string; notes?: string }) =>
      api.post(`/pos/cash-movements?branchId=${branchId}`, payload, { headers: { 'X-Silent-Error': '1' } }).then((r) => r.data),
    onSuccess: () => {
      setCashMovementError('');
      setCashMovementModalOpen(false);
      setCashMovementAmount('0');
      setCashMovementReason('');
      setCashMovementNotes('');
      setSuccessMsg('Movimiento de caja registrado.');
      setTimeout(() => setSuccessMsg(''), 2500);
      qc.invalidateQueries({ queryKey: ['pos-cash-state', branchId] });
      qc.invalidateQueries({ queryKey: ['pos-current-shift', branchId] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      setCashMovementError(Array.isArray(msg) ? msg.join(' · ') : String(msg ?? 'No se pudo registrar el movimiento.'));
    },
  });

  const submitOpenShift = () => {
    const openingCash = Number(openingCashInput);
    if (!Number.isFinite(openingCash) || openingCash < 0) return;
    setShiftError('');
    openShift.mutate(openingCash);
  };

  const submitCloseShift = () => {
    const closingCash = Number(closingCashInput);
    if (!Number.isFinite(closingCash) || closingCash < 0) return;
    setShiftError('');
    closeShift.mutate({
      closingCash,
      closingNotes: closingNotesInput.trim() || undefined,
    });
  };

  const submitCashMovement = () => {
    const amount = Number(cashMovementAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setCashMovementError('Debes indicar un monto valido.');
      return;
    }
    if (!cashMovementReason.trim()) {
      setCashMovementError('Debes indicar un motivo para el movimiento.');
      return;
    }

    setCashMovementError('');
    createCashMovement.mutate({
      direction: cashMovementDirection,
      category: cashMovementCategory,
      amount,
      reason: cashMovementReason.trim(),
      notes: cashMovementNotes.trim() || undefined,
    });
  };

  return (
    <>
      <BillingModal
        isOpen={showBilling}
        branchId={branchId}
        order={selectedOrder}
        customer={selectedOrder?.customer || selectedCustomer}
        initialStep={billingInitialStep}
        onClose={() => {
          setShowBilling(false);
          setSelectedOrder(null);
          qc.invalidateQueries({ queryKey: ['pos-pending-billing'] });
          qc.invalidateQueries({ queryKey: ['pos-tables'] });
        }}
        onCancelled={() => {
          setShowBilling(false);
          setSelectedOrder(null);
          qc.invalidateQueries({ queryKey: ['pos-pending-billing'] });
          qc.invalidateQueries({ queryKey: ['pos-tables'] });
        }}
      />

      {shiftModalMode && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-xl border border-gray-200 bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">
                {shiftModalMode === 'open' ? 'Apertura de caja' : 'Cierre de caja'}
              </h3>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600"
                onClick={() => setShiftModalMode(null)}
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              {shiftError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {shiftError}
                </div>
              )}

              {shiftModalMode === 'open' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Efectivo inicial</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={openingCashInput}
                      onChange={(e) => setOpeningCashInput(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={openShift.isPending}
                    onClick={submitOpenShift}
                    className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold py-2"
                  >
                    {openShift.isPending ? 'Abriendo...' : 'Abrir caja'}
                  </button>
                </>
              ) : (
                <>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
                        <p className="text-gray-500 uppercase tracking-wide">Apertura</p>
                        <p className="font-semibold text-gray-800">
                          {currentShift?.openedAt
                            ? new Date(currentShift.openedAt).toLocaleString('es-CR')
                            : 'N/A'}
                        </p>
                      </div>
                      <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
                        <p className="text-gray-500 uppercase tracking-wide">Cajero</p>
                        <p className="font-semibold text-gray-800">{currentShift?.openedBy?.name || 'No identificado'}</p>
                      </div>
                      <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
                        <p className="text-gray-500 uppercase tracking-wide">Caja inicial</p>
                        <p className="font-semibold text-gray-800">{formatCurrency(Number(currentShift?.openingCash ?? 0), settings)}</p>
                      </div>
                      <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
                        <p className="text-gray-500 uppercase tracking-wide">Ventas efectivo</p>
                        <p className="font-semibold text-gray-800">{formatCurrency(Number(cashState?.totals?.cashSales ?? 0), settings)}</p>
                      </div>
                      <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
                        <p className="text-gray-500 uppercase tracking-wide">Ventas tarjeta</p>
                        <p className="font-semibold text-gray-800">{formatCurrency(Number(cashState?.totals?.cardSales ?? 0), settings)}</p>
                      </div>
                      <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
                        <p className="text-gray-500 uppercase tracking-wide">Entradas manuales</p>
                        <p className="font-semibold text-emerald-700">{formatCurrency(Number(cashState?.totals?.totalCashIn ?? 0), settings)}</p>
                      </div>
                      <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
                        <p className="text-gray-500 uppercase tracking-wide">Salidas manuales</p>
                        <p className="font-semibold text-red-700">{formatCurrency(Number(cashState?.totals?.totalCashOut ?? 0), settings)}</p>
                      </div>
                      <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
                        <p className="text-gray-500 uppercase tracking-wide">Esperado en caja</p>
                        <p className="font-semibold text-gray-900">{formatCurrency(Number(cashState?.totals?.expectedCash ?? currentShift?.openingCash ?? 0), settings)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg bg-white border border-gray-200 overflow-hidden">
                    <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600">Movimientos recientes</h4>
                      <span className="text-[11px] text-gray-400">{cashState?.movements?.length ?? 0} registrados</span>
                    </div>
                    <div className="max-h-48 overflow-auto divide-y divide-gray-100">
                      {(cashState?.movements?.length ?? 0) === 0 && (
                        <div className="px-3 py-4 text-xs text-gray-500">Aun no hay movimientos manuales en este turno.</div>
                      )}
                      {(cashState?.movements ?? []).slice(0, 8).map((movement) => (
                        <div key={movement.id} className="px-3 py-2 flex items-start justify-between gap-3 text-xs">
                          <div className="min-w-0">
                            <p className="font-medium text-gray-800">
                              {movement.direction === 'IN' ? 'Entrada' : 'Salida'} · {formatCashCategory(movement.category)}
                            </p>
                            <p className="text-gray-500 truncate">{movement.reason}</p>
                            <p className="text-gray-400">{new Date(movement.createdAt).toLocaleString('es-CR')} · {movement.createdBy?.name || 'Usuario'}</p>
                          </div>
                          <span className={`font-semibold whitespace-nowrap ${movement.direction === 'IN' ? 'text-emerald-700' : 'text-red-700'}`}>
                            {movement.direction === 'IN' ? '+' : '-'}{formatCurrency(movement.amount, settings)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Efectivo contado al cierre</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={closingCashInput}
                      onChange={(e) => setClosingCashInput(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Notas de cierre (opcional)</label>
                    <textarea
                      rows={3}
                      value={closingNotesInput}
                      onChange={(e) => setClosingNotesInput(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      placeholder="Observaciones de arqueo o incidencias"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={closeShift.isPending}
                    onClick={submitCloseShift}
                    className="w-full rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-semibold py-2"
                  >
                    {closeShift.isPending ? 'Cerrando...' : 'Cerrar caja'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {cashMovementModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-2xl">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Movimiento de caja</h3>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600"
                onClick={() => setCashMovementModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              {cashMovementError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {cashMovementError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Tipo</label>
                  <select
                    value={cashMovementDirection}
                    onChange={(e) => setCashMovementDirection(e.target.value as 'IN' | 'OUT')}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="IN">Entrada</option>
                    <option value="OUT">Salida</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Categoria</label>
                  <select
                    value={cashMovementCategory}
                    onChange={(e) => setCashMovementCategory(e.target.value as CashMovementItem['category'])}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="CHANGE">Cambio</option>
                    <option value="PETTY_CASH">Caja chica</option>
                    <option value="REPLENISHMENT">Reposicion</option>
                    <option value="WITHDRAWAL">Retiro</option>
                    <option value="DEPOSIT">Deposito</option>
                    <option value="ADJUSTMENT">Ajuste</option>
                    <option value="OTHER">Otro</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Monto</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={cashMovementAmount}
                  onChange={(e) => setCashMovementAmount(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Motivo</label>
                <input
                  type="text"
                  value={cashMovementReason}
                  onChange={(e) => setCashMovementReason(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Ej: compra urgente, cambio, retiro"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Notas</label>
                <textarea
                  rows={3}
                  value={cashMovementNotes}
                  onChange={(e) => setCashMovementNotes(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Detalle adicional del movimiento"
                />
              </div>
              <button
                type="button"
                disabled={createCashMovement.isPending}
                onClick={submitCashMovement}
                className="w-full rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold py-2"
              >
                {createCashMovement.isPending ? 'Registrando...' : 'Guardar movimiento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera QR Scanner Modal */}
      {cameraModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 rounded-t-xl">
              <h2 className="text-lg font-bold text-white">Escanear código QR</h2>
              <p className="text-blue-100 text-sm">Apunta la cámara al código del cliente</p>
            </div>

            <div className="p-4 space-y-3">
              <div className="relative rounded-lg overflow-hidden border border-gray-300 bg-black aspect-[4/3] min-h-[220px]">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-6 border-2 border-white/80 rounded-lg" />
                  <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                    {qrStatus === 'starting' ? 'Iniciando cámara...' : qrStatus === 'error' ? 'Error de cámara' : 'Leyendo QR...'}
                  </div>
                </div>
              </div>
              <canvas ref={canvasRef} className="hidden" />

              <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                {detectedQrCode
                  ? `Código detectado: ${detectedQrCode}`
                  : qrStatus === 'error'
                    ? 'No se pudo acceder a la cámara.'
                    : 'Vista previa activa: acerca el código al recuadro para detectar automáticamente.'}
              </div>

              {qrStatus === 'error' && (
                <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-1">
                  <p className="font-semibold">Instrucciones para cajero:</p>
                  <p>1. Permite el uso de cámara en el navegador (icono junto a la URL).</p>
                  <p>2. Cierra otras apps que estén usando la cámara.</p>
                  <p>3. Presiona Reintentar cámara.</p>
                  <p>4. Si sigue fallando, ingresa el código manualmente en el campo de cliente.</p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={stopCamera}
                  className="w-full py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg text-sm"
                >
                  Cerrar
                </button>
                <button
                  onClick={() => {
                    stopCamera();
                    startCamera();
                  }}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm"
                >
                  Reintentar cámara
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tables Modal */}
      {tablesModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-4xl rounded-2xl border shadow-2xl max-h-[90vh] overflow-y-auto flex flex-col ${
            settings.theme === 'dark'
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-200'
          }`}>
            <div className={`sticky top-0 px-6 py-4 border-b flex items-center justify-between ${
              settings.theme === 'dark'
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-200'
            }`}>
              <h3 className={`text-lg font-bold ${settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>🪑 Gestión de mesas</h3>
              <button
                type="button"
                className={`text-xl transition-colors ${
                  settings.theme === 'dark'
                    ? 'text-gray-400 hover:text-gray-300'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
                onClick={() => setTablesModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className={settings.theme === 'dark' ? 'bg-gray-800 p-6' : 'bg-white p-6'}>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {tables.map((t: PosTable) => {
                  const STATUS_COLORS_LIGHT: Record<string, string> = {
                    free: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                    occupied: 'bg-red-100 text-red-700 border-red-200',
                    waiting_food: 'bg-amber-100 text-amber-700 border-amber-200',
                    bill_requested: 'bg-orange-100 text-orange-700 border-orange-200',
                    reserved: 'bg-blue-100 text-blue-700 border-blue-200',
                  };

                  const STATUS_COLORS_DARK: Record<string, string> = {
                    free: 'bg-emerald-900 text-emerald-200 border-emerald-700',
                    occupied: 'bg-red-900 text-red-200 border-red-700',
                    waiting_food: 'bg-amber-900 text-amber-200 border-amber-700',
                    bill_requested: 'bg-orange-900 text-orange-200 border-orange-700',
                    reserved: 'bg-blue-900 text-blue-200 border-blue-700',
                  };

                  const STATUS_COLORS = settings.theme === 'dark' ? STATUS_COLORS_DARK : STATUS_COLORS_LIGHT;

                  const STATUS_LABELS: Record<string, string> = {
                    free: 'Libre',
                    occupied: 'Ocupada',
                    waiting_food: 'Esperando comida',
                    bill_requested: 'Pide la cuenta',
                    reserved: 'Reservada',
                  };

                  const STATUS_EMOJIS: Record<string, string> = {
                    free: '✓',
                    occupied: '👥',
                    waiting_food: '⏱️',
                    bill_requested: '💳',
                    reserved: '📌',
                  };

                  const status = String(t.status).toLowerCase();
                  const isSelected = tableId === t.id;
                  const colorClass = STATUS_COLORS[status] || (settings.theme === 'dark' ? 'bg-gray-700 text-gray-400 border-gray-600' : 'bg-gray-100 text-gray-500 border-gray-200');

                  return (
                    <div
                      key={t.id}
                      className={`rounded-xl border-2 p-3 transition-all ${
                        isSelected
                          ? settings.theme === 'dark'
                            ? 'border-brand-600 bg-brand-900'
                            : 'border-brand-600 bg-brand-50'
                          : settings.theme === 'dark'
                            ? 'border-gray-700 hover:border-gray-600'
                            : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="mb-2">
                        <p className={`text-base font-bold ${settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>🪑 Mesa {t.number}</p>
                      </div>
                      <div className="mb-2">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold border ${colorClass}`}>
                          {STATUS_EMOJIS[status]} {STATUS_LABELS[status] || status}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          if (status === 'free' || status === 'reserved') {
                            setTableId(t.id);
                            setTablesModalOpen(false);
                          }
                        }}
                        disabled={status !== 'free' && status !== 'reserved'}
                        className={`w-full text-xs py-1.5 rounded-lg font-semibold transition-colors ${
                          isSelected
                            ? 'bg-brand-600 text-white'
                            : status === 'free' || status === 'reserved'
                              ? settings.theme === 'dark'
                                ? 'bg-brand-900 text-brand-200 hover:bg-brand-800'
                                : 'bg-brand-100 text-brand-700 hover:bg-brand-200'
                              : settings.theme === 'dark'
                                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {isSelected ? '✓ Seleccionada' : 'Seleccionar'}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Acciones rápidas</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {tables.map((t: PosTable) => {
                    const status = String(t.status).toLowerCase();
                    return (
                      <div key={t.id} className="space-y-1">
                        {status === 'occupied' && (
                          <button
                            onClick={() => updateTableStatus.mutate({ id: t.id, status: 'bill_requested' })}
                            className={`w-full text-xs py-1 border rounded-lg transition-colors font-semibold ${
                              settings.theme === 'dark'
                                ? 'border-orange-700 text-orange-300 hover:bg-orange-900'
                                : 'border-orange-300 text-orange-600 hover:bg-orange-50'
                            }`}
                          >
                            Mesa {t.number}: Pedir cuenta
                          </button>
                        )}
                        {(status === 'bill_requested' || status === 'waiting_food') && (
                          <button
                            onClick={() => updateTableStatus.mutate({ id: t.id, status: 'free' })}
                            className={`w-full text-xs py-1 border rounded-lg transition-colors font-semibold ${
                              settings.theme === 'dark'
                                ? 'border-emerald-700 text-emerald-300 hover:bg-emerald-900'
                                : 'border-emerald-300 text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            Mesa {t.number}: Liberar
                          </button>
                        )}
                        {status === 'free' && (
                          <button
                            onClick={() => updateTableStatus.mutate({ id: t.id, status: 'reserved' })}
                            className={`w-full text-xs py-1 border rounded-lg transition-colors font-semibold ${
                              settings.theme === 'dark'
                                ? 'border-blue-700 text-blue-300 hover:bg-blue-900'
                                : 'border-blue-300 text-blue-600 hover:bg-blue-50'
                            }`}
                          >
                            Mesa {t.number}: Reservar
                          </button>
                        )}
                        {status === 'reserved' && (
                          <button
                            onClick={() => updateTableStatus.mutate({ id: t.id, status: 'free' })}
                            className={`w-full text-xs py-1 border rounded-lg transition-colors font-semibold ${
                              settings.theme === 'dark'
                                ? 'border-slate-600 text-slate-300 hover:bg-slate-700'
                                : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            Mesa {t.number}: Cancelar reserva
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`flex h-screen overflow-hidden flex-col xl:flex-row ${settings.theme === 'dark' ? 'dark' : ''}`}>
        <div className="xl:hidden bg-white border-b border-gray-200 p-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMobileSection('orders')}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                mobileSection === 'orders' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              Ordenes nuevas
            </button>
            <button
              onClick={() => setMobileSection('billing')}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                mobileSection === 'billing' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              Facturacion ({pendingOrders.length})
            </button>
          </div>
        </div>

        <div
          className={`${mobileSection === 'orders' ? 'flex' : 'hidden'} xl:flex flex-1 xl:flex-[2] min-w-0 min-h-0 flex-col overflow-hidden xl:border-r border-gray-200`}
        >
          <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
            <span className="font-bold text-lg">POS</span>
            {isSuperAdmin && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sucursal</span>
                <select
                  value={branchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="h-8 rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">Seleccionar...</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex gap-2 items-center">
              {canManageShift && (
                <>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ${
                      currentShift
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {currentShiftLoading ? 'Caja...' : currentShift ? 'Caja abierta' : 'Caja cerrada'}
                  </span>
                  {currentShift && (
                    <button
                      type="button"
                      onClick={() => {
                        setCashMovementDirection('OUT');
                        setCashMovementCategory('PETTY_CASH');
                        setCashMovementAmount('0');
                        setCashMovementReason('');
                        setCashMovementNotes('');
                        setCashMovementError('');
                        setCashMovementModalOpen(true);
                      }}
                      className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200"
                    >
                      Movimiento caja
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={currentShiftLoading}
                    onClick={() => {
                      if (currentShift) {
                        setClosingCashInput(String(toAmount(cashState?.totals?.expectedCash ?? currentShift.openingCash)));
                        setClosingNotesInput('');
                        setShiftError('');
                        setShiftModalMode('close');
                        return;
                      }
                      setOpeningCashInput('0');
                      setShiftError('');
                      setShiftModalMode('open');
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      currentShift
                        ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                        : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    }`}
                  >
                    {currentShift ? 'Cerrar caja' : 'Abrir caja'}
                  </button>
                </>
              )}
              <FacturingStatusIndicator />
              {['DINE_IN', 'TO_GO', 'DELIVERY'].map((t) => (
                <button
                  key={t}
                  onClick={() => setOrderType(t as UiOrderType)}
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    orderType === t ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {t === 'DINE_IN' ? 'Mesa' : t === 'TO_GO' ? 'Para llevar' : 'Delivery'}
                </button>
              ))}
            </div>
            <button onClick={() => logout()} className="text-xs text-red-500">Salir</button>
          </div>

          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700">Seccion de ordenes</h2>
            <p className="text-xs text-gray-500">
              Crea y envia ordenes a cocina. La facturacion se procesa en el panel derecho.
            </p>
          </div>

          <div className="flex-1 min-h-0 flex flex-col xl:flex-row">
            <div className="flex-[3] min-h-0 min-w-0 flex flex-col overflow-hidden">
              <div className="bg-white border-b border-gray-200 px-4 py-2 flex gap-2 overflow-x-auto">
                <button
                  onClick={() => setActiveCategory(null)}
                  className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium ${
                    !activeCategory ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  Todos
                </button>
                {categories.map((c: { id: string; name: string }) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveCategory(c.id)}
                    className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium ${
                      activeCategory === c.id ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 content-start">
                {products
                  .filter((p: { isActive: boolean }) => p.isActive)
                  .map((p: { id: string; name: string; price: number; imageUrl?: string; taxRate?: number }) => (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p)}
                      className="aspect-square relative overflow-hidden rounded-xl border border-gray-200 hover:shadow-md active:scale-95 transition-all text-left bg-gray-100"
                    >
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-2xl text-gray-300">🍽️</div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-2">
                        <p className="text-xs font-semibold text-white line-clamp-2 leading-tight">{p.name}</p>
                        <p className="text-sm font-bold text-orange-300 mt-0.5">{formatCurrency(p.price, settings)}</p>
                      </div>
                    </button>
                  ))}
              </div>
            </div>

            <div className="flex-[2] min-h-0 xl:flex-none w-full xl:w-80 bg-white border-t xl:border-t-0 xl:border-l border-gray-200 flex flex-col">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-bold text-gray-800">Orden actual</h3>

                {/* Cliente */}
                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cliente (opcional)</label>
                  {selectedCustomer ? (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-blue-900 truncate">{selectedCustomer.name}</p>
                        <p className="text-xs text-blue-700">{selectedCustomer.code}</p>
                        <p className="text-xs text-blue-600">Puntos: {selectedCustomer.loyaltyPoints}</p>
                      </div>
                      <button
                        onClick={() => setSelectedCustomer(null)}
                        className="ml-2 text-blue-500 hover:text-blue-700 text-sm font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={customerSearchCode}
                        onChange={(e) => {
                          setCustomerSearchCode(e.target.value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && customerSearchCode.trim()) {
                            searchCustomer.mutate(customerSearchCode);
                          }
                        }}
                        placeholder="Código cliente o número"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => searchCustomer.mutate(customerSearchCode)}
                          disabled={!customerSearchCode.trim() || searchCustomer.isPending}
                          className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors flex-1"
                        >
                          🔍 Buscar
                        </button>
                        <button
                          onClick={() => (cameraModalOpen ? stopCamera() : startCamera())}
                          className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors flex-1 ${
                            cameraModalOpen 
                              ? 'bg-red-600 hover:bg-red-700' 
                              : 'bg-blue-600 hover:bg-blue-700'
                          }`}
                        >
                          {cameraModalOpen ? '✕ Cerrar' : '📷 QR'}
                        </button>
                      </div>
                      {searchCustomer.isPending && (
                        <p className="text-xs text-gray-500">Buscando...</p>
                      )}
                      {searchCustomer.isError && (
                        <p className="text-xs text-red-600">Cliente no encontrado</p>
                      )}
                    </div>
                  )}
                </div>

                {orderType === 'DINE_IN' && (
                  <>
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <label className="block text-xs font-medium text-gray-600 mb-2">Seleccionar mesa</label>
                      <div className="flex gap-2">
                        <select
                          value={tableId}
                          onChange={(e) => setTableId(e.target.value)}
                          className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        >
                          <option value="">Seleccionar mesa...</option>
                          {freeTables.map((t) => (
                            <option key={t.id} value={t.id}>Mesa {t.number}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => setTablesModalOpen(true)}
                          className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm font-semibold transition-colors flex-shrink-0"
                          title="Ver estado de todas las mesas"
                        >
                          🪑 Ver mesas
                        </button>
                      </div>
                      {freeTables.length === 0 && (
                        <p className="text-xs text-amber-600 mt-2">No hay mesas libres en este momento.</p>
                      )}
                    </div>
                  </>
                )}

                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-gray-600">Nota para cocina</label>
                    <span className="text-[11px] text-gray-400">{kitchenNote.length}/250</span>
                  </div>
                  <textarea
                    value={kitchenNote}
                    onChange={(e) => setKitchenNote(e.target.value)}
                    rows={1}
                    maxLength={250}
                    placeholder="Ej: sin azucar, alergia..."
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {cart.length === 0 && (
                  <p className="text-gray-400 text-sm text-center mt-10">Carrito vacio</p>
                )}
                {cart.map((item) => (
                  <div key={item.productId} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{item.productName}</p>
                      <p className="text-xs text-gray-500">{formatCurrency(item.price, settings)} c/u</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => removeFromCart(item.productId)}
                        className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-xs font-bold"
                      >
                        -
                      </button>
                      <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                      <button
                        onClick={() =>
                          addToCart({ id: item.productId, name: item.productName, price: item.price, taxRate: item.taxRate })
                        }
                        className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-xs font-bold"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-sm font-semibold text-gray-700 w-16 text-right">
                      {formatCurrency(item.price * item.quantity, settings)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-gray-200">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-medium">{formatCurrency(subtotal, settings)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Impuesto</span>
                  <span>{formatCurrency(taxAmount, settings)}</span>
                </div>
                <div className="flex justify-between text-sm mb-2 font-semibold">
                  <span className="text-gray-700">Total</span>
                  <span>{formatCurrency(totalWithTax, settings)}</span>
                </div>
                {successMsg && (
                  <p className="text-green-600 text-sm font-medium mb-2 text-center">{successMsg}</p>
                )}
                {missingRequiredTable && (
                  <p className="text-amber-600 text-xs font-medium mb-2 text-center">
                    Debes seleccionar una mesa para enviar una orden tipo Mesa.
                  </p>
                )}
                <button
                  onClick={() => placeOrder.mutate()}
                  disabled={cart.length === 0 || placeOrder.isPending || missingRequiredTable}
                  className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold rounded-xl text-base transition-colors"
                >
                  {placeOrder.isPending ? 'Enviando...' : `Enviar a cocina - ${formatCurrency(totalWithTax, settings)}`}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div
          className={`${mobileSection === 'billing' ? 'flex' : 'hidden'} xl:flex w-full xl:w-auto xl:flex-[1] min-h-0 bg-gray-50 flex-col`}
        >
          <div className="px-4 py-3 border-b border-gray-200 bg-white space-y-3">
            <div>
              <h2 className="font-bold text-gray-800">Facturacion</h2>
              <p className="text-xs text-gray-500">
                Ordenes enviadas sin facturar y consulta rápida de facturas del día.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setBillingTab('pending')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  billingTab === 'pending' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                Pendientes ({pendingOrders.length})
              </button>
              <button
                onClick={() => setBillingTab('history')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  billingTab === 'history' ? 'bg-slate-700 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                Historial de hoy
              </button>
            </div>
          </div>

          {billingTab === 'pending' && (
            <div className="px-4 py-2 border-b border-gray-200 bg-white text-sm text-gray-600">
              Pendientes: <span className="font-semibold text-gray-800">{pendingOrders.length}</span>
            </div>
          )}

          {billingTab === 'history' && (
            <div className="px-4 py-2 border-b border-gray-200 bg-white">
              <input
                type="text"
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
                placeholder="Buscar en facturas de hoy (factura, orden, cliente o código)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {billingTab === 'pending' && (
              <>
                {pendingOrdersLoading && (
                  <p className="text-sm text-gray-500">Cargando ordenes pendientes...</p>
                )}

                {!pendingOrdersLoading && pendingOrders.length === 0 && (
                  <div className="text-sm text-gray-500 bg-white border border-dashed border-gray-300 rounded-xl p-4 text-center">
                    No hay ordenes pendientes de facturacion.
                  </div>
                )}

                {pendingOrders.map((order) => {
              const isKioskOrigin = order.type === 'kiosk' || (!order.table?.number && !order.userId);
              const sourceLabel =
                isKioskOrigin
                  ? 'Kiosko'
                  : order.type === 'takeout'
                    ? 'Para llevar'
                    : order.type === 'delivery'
                      ? 'Delivery'
                  : order.table?.number
                    ? `Mesa ${order.table.number}`
                    : 'Sin mesa';

              return (
                <div key={order.id} className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-800">Orden #{order.orderNumber}</p>
                      <p className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleString()}</p>
                    </div>
                    <span
                      className={`text-[11px] px-2 py-1 rounded-full font-semibold ${
                        isKioskOrigin ? 'bg-cyan-100 text-cyan-700' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {sourceLabel}
                    </span>
                  </div>

                  <div className="text-xs text-gray-600 space-y-1 max-h-20 overflow-y-auto">
                    {order.items.slice(0, 4).map((item) => (
                      <p key={item.id}>{item.quantity}x {item.productName}</p>
                    ))}
                    {order.items.length > 4 && (
                      <p className="text-gray-400">+{order.items.length - 4} item(s) mas...</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                    <span className="text-sm text-gray-500">Total</span>
                    <span className="font-bold text-brand-600">{formatCurrency(Number(order.total || 0), settings)}</span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => openCancelForOrder(order)}
                      className="flex-none py-2 px-3 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-semibold transition-colors"
                    >
                      🚫 Cancelar
                    </button>
                    <button
                      onClick={() => openBillingForOrder(order)}
                      className="flex-1 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold"
                    >
                      Facturar orden
                    </button>
                  </div>
                </div>
              );
                })}
              </>
            )}

            {billingTab === 'history' && (
              <>
                {invoicesHistoryLoading && (
                  <p className="text-sm text-gray-500">Cargando historial de facturas...</p>
                )}

                {!invoicesHistoryLoading && filteredInvoices.length === 0 && (
                  <div className="text-sm text-gray-500 bg-white border border-dashed border-gray-300 rounded-xl p-4 text-center">
                    No hay facturas para el criterio de búsqueda.
                  </div>
                )}

                {filteredInvoices.map((inv) => (
                  <div key={inv.id} className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-800">Factura {inv.invoiceNumber}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(inv.createdAt).toLocaleString()} · Orden #{inv.order?.orderNumber || '-'}
                        </p>
                      </div>
                      <span
                        className={`text-[11px] px-2 py-1 rounded-full font-semibold ${
                          inv.status === 'issued'
                            ? 'bg-green-100 text-green-700'
                            : inv.status === 'cancelled'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {inv.status === 'issued' ? 'Emitida' : inv.status === 'cancelled' ? 'Anulada' : 'NC'}
                      </span>
                    </div>

                    <div className="text-xs text-gray-600 space-y-1 max-h-20 overflow-y-auto">
                      {inv.order?.items?.slice(0, 4).map((item) => (
                        <p key={item.id}>{item.quantity}x {item.productName}</p>
                      ))}
                      {(inv.order?.items?.length || 0) > 4 && (
                        <p className="text-gray-400">+{(inv.order?.items?.length || 0) - 4} item(s) mas...</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                      <span className="text-sm text-gray-500">Cliente</span>
                      <span className="text-sm font-medium text-gray-800 truncate max-w-[180px] text-right">
                        {inv.customerName || inv.order?.customer?.name || 'Consumidor final'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Total</span>
                      <span className="font-bold text-brand-600">{formatCurrency(toAmount(inv.total), settings)}</span>
                    </div>

                    <button
                      onClick={() => printHistoryInvoice(inv)}
                      className="w-full py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-colors"
                    >
                      🖨️ Reimprimir factura
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
