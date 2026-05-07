import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import jsQR from 'jsqr';
import api from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth.store';
import { useSettings } from '../../../hooks/useSettings';
import { fmtMoney, formatCurrency } from '../../../stores/settings.store';
import { BillingModal } from '../components/BillingModal';

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
  const branchId = user?.branchId ?? '';
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
  const todayDate = toDateInputValue(new Date());

  // Camera QR scanning states
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

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

  const { data: pendingOrders = [], isLoading: pendingOrdersLoading } = useQuery<PendingOrder[]>({
    queryKey: ['pos-pending-billing', branchId],
    queryFn: () =>
      api
        .get(`/orders?branchId=${branchId}`)
        .then((r) => r.data)
        .then((orders: PendingOrder[]) =>
          orders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled'),
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
          <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
            <span className="font-bold text-lg">POS</span>
            <div className="flex gap-2">
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
                      <div className="flex flex-col sm:flex-row gap-2">
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
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                        <button
                          onClick={() => searchCustomer.mutate(customerSearchCode)}
                          disabled={!customerSearchCode.trim() || searchCustomer.isPending}
                          className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors sm:w-auto"
                        >
                          🔍 Buscar
                        </button>
                      </div>
                      <button
                        onClick={() => (cameraModalOpen ? stopCamera() : startCamera())}
                        className={`w-full py-2.5 rounded-lg text-sm font-medium text-white transition-colors ${
                          cameraModalOpen 
                            ? 'bg-red-600 hover:bg-red-700' 
                            : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                      >
                        {cameraModalOpen ? '✕ Cerrar cámara' : '📷 Escanear QR'}
                      </button>
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
                    <select
                      value={tableId}
                      onChange={(e) => setTableId(e.target.value)}
                      className="mt-2 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="">Seleccionar mesa...</option>
                      {freeTables.map((t) => (
                        <option key={t.id} value={t.id}>Mesa {t.number}</option>
                      ))}
                    </select>
                    {freeTables.length === 0 && (
                      <p className="text-xs text-amber-600 mt-2">No hay mesas libres en este momento.</p>
                    )}
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
