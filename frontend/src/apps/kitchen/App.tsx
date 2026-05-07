import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { useSocket } from '../../hooks/useSocket';
import { useAuthStore } from '../../stores/auth.store';

interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  notes?: string;
  modifiers: { optionName: string }[];
}

interface Order {
  id: string;
  orderNumber: string;
  type: string;
  status: string;
  createdAt: string;
  preparationStartedAt?: string | null;
  readyAt?: string | null;
  kitchenPrintedAt?: string | null;
  notes?: string;
  table?: { number: number };
  customer?: { name?: string; code?: string; phone?: string } | null;
  items: OrderItem[];
}

function sourceLabel(order: Order): string {
  const type = String(order.type || '').toLowerCase();
  if (type === 'kiosk') return 'Kiosko';
  if (type === 'takeout' || type === 'to_go') return 'Para llevar';
  if (type === 'delivery') return 'Delivery';
  if ((type === 'dine_in' || type === 'dinein') && !order.table?.number) return 'Kiosko';
  if (order.table?.number) return `Mesa ${order.table.number}`;
  return 'Sin mesa';
}

function elapsed(createdAt: string): string {
  const secs = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function kitchenStage(order: Order): 'new' | 'in_preparation' | 'ready' {
  if (order.readyAt) return 'ready';
  if (order.preparationStartedAt) return 'in_preparation';
  return 'new';
}

function kitchenStageLabel(order: Order): string {
  const stage = kitchenStage(order);
  if (stage === 'ready') return 'Lista';
  if (stage === 'in_preparation') return 'En preparación';
  return 'Nuevo';
}

function kitchenStageBadge(order: Order): string {
  const stage = kitchenStage(order);
  if (stage === 'ready') return 'bg-emerald-500';
  if (stage === 'in_preparation') return 'bg-sky-600';
  return 'bg-amber-500';
}

function formatClock(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' });
}

function customerLabel(order: Order): string {
  return order.customer?.name || order.customer?.code || 'Consumidor final';
}

function minutesBetween(from?: string | null, to?: string | null): number | null {
  if (!from || !to) return null;
  const diff = new Date(to).getTime() - new Date(from).getTime();
  if (!Number.isFinite(diff) || diff < 0) return null;
  return diff / 60000;
}

function avgMinutes(values: Array<number | null>): number {
  const valid = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (valid.length === 0) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function buildKitchenTicketHtml(order: Order): string {
  const printedAt = new Date().toLocaleString('es-CR');
  const itemsHtml = order.items.map((item) => {
    const modifiers = item.modifiers?.length > 0
      ? `<div class="mods">${item.modifiers.map((m) => `+ ${m.optionName}`).join('<br/>')}</div>`
      : '';
    const notes = item.notes ? `<div class="note">Nota: ${item.notes}</div>` : '';
    return `
      <div class="item">
        <div class="item-line"><strong>${item.quantity}x ${item.productName}</strong></div>
        ${modifiers}
        ${notes}
      </div>
    `;
  }).join('');

  const orderNotes = order.notes ? `<div class="section small"><strong>Nota general:</strong> ${order.notes}</div>` : '';

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Ticket cocina #${order.orderNumber}</title>
        <style>
          @page { size: 80mm auto; margin: 4mm; }
          * { box-sizing: border-box; }
          body {
            font-family: Arial, Helvetica, sans-serif;
            margin: 0;
            color: #000;
            width: 72mm;
          }
          .wrap { width: 100%; }
          .center { text-align: center; }
          .title {
            font-size: 14px;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            margin-bottom: 4px;
          }
          .order-number {
            font-size: 44px;
            font-weight: 800;
            line-height: 1;
            border: 2px solid #000;
            border-radius: 10px;
            padding: 8px 0;
            margin: 8px 0 10px;
          }
          .meta {
            font-size: 11px;
            line-height: 1.4;
            margin-bottom: 10px;
          }
          .section {
            border-top: 1px dashed #000;
            padding-top: 8px;
            margin-top: 8px;
          }
          .item {
            margin-bottom: 8px;
            font-size: 12px;
          }
          .item-line {
            font-size: 13px;
          }
          .mods, .note, .small {
            font-size: 10px;
            line-height: 1.35;
            color: #333;
            margin-left: 8px;
            margin-top: 2px;
          }
          .footer {
            margin-top: 10px;
            border-top: 1px dashed #000;
            padding-top: 8px;
            font-size: 10px;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="center title">Ticket de Cocina</div>
          <div class="center order-number">#${order.orderNumber}</div>
          <div class="meta center">
            ${sourceLabel(order)}<br/>
            Cliente: ${customerLabel(order)}<br/>
            Impreso: ${printedAt}
          </div>
          <div class="section">${itemsHtml}</div>
          ${orderNotes}
          <div class="footer">Colocar este ticket junto al pedido listo para entrega</div>
        </div>
      </body>
    </html>
  `;
}

function printHtml(html: string) {
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
  if (!doc || !win) {
    if (document.body.contains(frame)) document.body.removeChild(frame);
    throw new Error('No se pudo abrir el documento de impresión');
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
}

function OrderCard({
  order,
  onStartPreparation,
  onReady,
  onPrint,
  busyAction,
}: {
  order: Order;
  onStartPreparation: (order: Order) => void;
  onReady: (order: Order) => void;
  onPrint: (order: Order) => void;
  busyAction?: string | null;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const mins = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);
  const urgent = mins >= 10;
  const stage = kitchenStage(order);
  const isBusy = busyAction === order.id;

  return (
    <div className={`rounded-2xl border p-5 flex flex-col gap-4 shadow-sm ${urgent ? 'border-red-500/60 bg-red-950/40' : 'border-white/10 bg-white/5'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-4xl md:text-5xl font-black tracking-tight text-white leading-none">#{order.orderNumber}</div>
          <div className="mt-2 text-sm text-slate-300">{sourceLabel(order)}</div>
        </div>
        <span className={`text-sm font-mono px-3 py-1 rounded-lg ${urgent ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-100'}`}>
          ⏱ {elapsed(order.createdAt)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`px-2 py-1 rounded-full text-white font-semibold ${kitchenStageBadge(order)}`}>
          {kitchenStageLabel(order)}
        </span>
        {order.kitchenPrintedAt && (
          <span className="px-2 py-1 rounded-full bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-500/30">
            Ticket impreso
          </span>
        )}
      </div>

      <div className="text-xs text-slate-400 space-y-1">
        <div><span className="text-slate-500">Cliente:</span> {customerLabel(order)}</div>
        {order.customer?.phone && <div><span className="text-slate-500">Tel:</span> {order.customer.phone}</div>}
        <div><span className="text-slate-500">Creada:</span> {formatClock(order.createdAt)}</div>
        {stage !== 'new' && <div><span className="text-slate-500">Inicio prep.:</span> {formatClock(order.preparationStartedAt)}</div>}
      </div>

      {order.notes && (
        <div className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          Nota general: {order.notes}
        </div>
      )}

      <ul className="space-y-2">
        {order.items.map((item) => (
          <li key={item.id} className="text-sm">
            <span className="font-semibold text-white">{item.quantity}x {item.productName}</span>
            {item.modifiers?.length > 0 && (
              <div className="text-xs text-slate-400 ml-4 mt-1">
                {item.modifiers.map((m, i) => <span key={i}>+ {m.optionName}{i < item.modifiers.length - 1 ? ', ' : ''}</span>)}
              </div>
            )}
            {item.notes && <div className="text-xs text-amber-300 ml-4 mt-1">Nota: {item.notes}</div>}
          </li>
        ))}
      </ul>

      <div className="mt-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPrint(order)}
          className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-semibold text-slate-100 transition-colors"
        >
          🖨 Imprimir
        </button>

        {stage === 'new' && (
          <button
            type="button"
            onClick={() => onStartPreparation(order)}
            disabled={isBusy}
            className="flex-1 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 active:bg-sky-700 disabled:opacity-60 text-sm font-semibold text-white transition-colors"
          >
            {isBusy ? 'Procesando...' : 'Preparación'}
          </button>
        )}

        {stage === 'in_preparation' && (
          <button
            type="button"
            onClick={() => onReady(order)}
            disabled={isBusy}
            className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-60 text-sm font-semibold text-white transition-colors"
          >
            {isBusy ? 'Procesando...' : 'Listo'}
          </button>
        )}
      </div>
    </div>
  );
}

function ReadyCard({ order, onPrint }: { order: Order; onPrint: (order: Order) => void }) {
  return (
    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-black text-white leading-none">#{order.orderNumber}</div>
          <div className="mt-1 text-xs text-emerald-100">{customerLabel(order)}</div>
        </div>
        <div className="text-right text-xs text-emerald-200">
          <div>{sourceLabel(order)}</div>
          <div>Lista {formatClock(order.readyAt)}</div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="text-xs text-slate-300 truncate">{order.items.map((item) => `${item.quantity}x ${item.productName}`).join(' · ')}</div>
        <button
          type="button"
          onClick={() => onPrint(order)}
          className="px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white shrink-0"
        >
          🖨
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const branchId = user?.branchId ?? '';
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ['kitchen-orders', branchId],
    queryFn: () =>
      api.get(`/kitchen/orders?branchId=${branchId}`).then((r) => r.data),
    enabled: !!branchId,
    refetchInterval: 15_000,
  });

  useSocket({
    branchId,
    events: {
      'kitchen:new_order': () => qc.invalidateQueries({ queryKey: ['kitchen-orders'] }),
      'order:status_updated': () => qc.invalidateQueries({ queryKey: ['kitchen-orders'] }),
      'order:ready': () => qc.invalidateQueries({ queryKey: ['kitchen-orders'] }),
    },
    enabled: !!branchId,
  });

  const startPreparation = useMutation({
    mutationFn: (orderId: string) => api.patch(`/kitchen/orders/${orderId}/start-preparation?branchId=${branchId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kitchen-orders'] }),
  });

  const markReady = useMutation({
    mutationFn: (orderId: string) => api.patch(`/kitchen/orders/${orderId}/ready?branchId=${branchId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kitchen-orders'] }),
  });

  const markPrinted = useMutation({
    mutationFn: (orderId: string) => api.patch(`/kitchen/orders/${orderId}/printed?branchId=${branchId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kitchen-orders'] }),
  });

  const activeOrders = useMemo(
    () => [...orders]
      .filter((order) => !order.readyAt)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [orders],
  );

  const readyOrders = useMemo(
    () => [...orders]
      .filter((order) => !!order.readyAt)
      .sort((a, b) => new Date(b.readyAt || 0).getTime() - new Date(a.readyAt || 0).getTime()),
    [orders],
  );

  const prepStartedOrders = useMemo(
    () => orders.filter((order) => !!order.preparationStartedAt),
    [orders],
  );

  const printedOrdersCount = useMemo(
    () => orders.filter((order) => !!order.kitchenPrintedAt).length,
    [orders],
  );

  const avgWaitMins = useMemo(
    () => avgMinutes(prepStartedOrders.map((order) => minutesBetween(order.createdAt, order.preparationStartedAt))),
    [prepStartedOrders],
  );

  const avgPrepMins = useMemo(
    () => avgMinutes(readyOrders.map((order) => minutesBetween(order.preparationStartedAt, order.readyAt))),
    [readyOrders],
  );

  const avgKitchenCycleMins = useMemo(
    () => avgMinutes(readyOrders.map((order) => minutesBetween(order.createdAt, order.readyAt))),
    [readyOrders],
  );

  const handlePrint = async (order: Order) => {
    setBusyAction(order.id);
    try {
      await markPrinted.mutateAsync(order.id);
      printHtml(buildKitchenTicketHtml(order));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo imprimir el ticket');
    } finally {
      setBusyAction(null);
    }
  };

  const handleStartPreparation = async (order: Order) => {
    setBusyAction(order.id);
    try {
      await startPreparation.mutateAsync(order.id);
    } finally {
      setBusyAction(null);
    }
  };

  const handleReady = async (order: Order) => {
    setBusyAction(order.id);
    try {
      await markReady.mutateAsync(order.id);
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="min-h-screen p-6 bg-slate-950 text-white">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight">🍳 Cocina — KDS</h1>
          <p className="text-sm text-slate-400 mt-1">Control de preparación, ticket de mostrador y pila de pedidos listos del día</p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-slate-400 text-xs uppercase tracking-wide">Activas</div>
            <div className="text-2xl font-bold">{activeOrders.length}</div>
          </div>
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
            <div className="text-emerald-200 text-xs uppercase tracking-wide">Listas hoy</div>
            <div className="text-2xl font-bold text-emerald-100">{readyOrders.length}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-amber-200">Prom. espera inicio</div>
          <div className="text-2xl font-bold text-amber-100">{avgWaitMins.toFixed(1)} min</div>
        </div>
        <div className="rounded-xl border border-sky-500/25 bg-sky-500/10 px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-sky-200">Prom. preparación</div>
          <div className="text-2xl font-bold text-sky-100">{avgPrepMins.toFixed(1)} min</div>
        </div>
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-emerald-200">Prom. ciclo cocina</div>
          <div className="text-2xl font-bold text-emerald-100">{avgKitchenCycleMins.toFixed(1)} min</div>
        </div>
        <div className="rounded-xl border border-fuchsia-500/25 bg-fuchsia-500/10 px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-fuchsia-200">Tickets impresos</div>
          <div className="text-2xl font-bold text-fuchsia-100">{printedOrdersCount}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <section className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Órdenes en cocina</h2>
            <span className="text-xs text-slate-400">Botón 1: Preparación. Botón 2: Listo.</span>
          </div>

          {activeOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[320px] rounded-2xl border border-dashed border-white/10 bg-white/[0.03] text-slate-500">
              <span className="text-5xl mb-4">✅</span>
              <p className="text-lg text-slate-300">Sin órdenes activas en cocina</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {activeOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onStartPreparation={handleStartPreparation}
                  onReady={handleReady}
                  onPrint={handlePrint}
                  busyAction={busyAction}
                />
              ))}
            </div>
          )}
        </section>

        <aside className="lg:col-span-1">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sticky top-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Listas hoy</h2>
                <p className="text-xs text-slate-400">Más recientes arriba</p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-200 text-xs font-semibold">
                {readyOrders.length}
              </span>
            </div>

            {readyOrders.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-500">
                Aún no hay pedidos listos hoy.
              </div>
            ) : (
              <div className="space-y-3 max-h-[calc(100vh-180px)] overflow-auto pr-1">
                {readyOrders.map((order) => (
                  <ReadyCard key={order.id} order={order} onPrint={handlePrint} />
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
