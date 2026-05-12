import { useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../../lib/api';
import { useKioskStore } from './store/kiosk.store';
import { useSettingsLoader } from '../../hooks/useSettings';
import { i18n } from './i18n/strings';
import WelcomeScreen from './screens/WelcomeScreen';
import CustomerScreen from './screens/CustomerScreen';
import OrderTypeScreen from './screens/OrderTypeScreen';
import MenuScreen from './screens/MenuScreen';
import ProductDetailScreen from './screens/ProductDetailScreen';
import CartScreen from './screens/CartScreen';
import PaymentScreen from './screens/PaymentScreen';
import ConfirmationScreen from './screens/ConfirmationScreen';

// branchId fijo para el kiosco, configurado por query string o env
const params = new URLSearchParams(window.location.search);
export const BRANCH_ID = params.get('branchId') ?? import.meta.env.VITE_KIOSK_BRANCH_ID ?? '';
const INACTIVITY_MS = Number(params.get('timeout') ?? 60) * 1000;

export { i18n };

function mapKioskOrderType(type: 'DINE_IN' | 'TO_GO' | null): 'dine_in' | 'takeout' | 'kiosk' {
  if (type === 'DINE_IN') return 'dine_in';
  if (type === 'TO_GO') return 'takeout';
  return 'kiosk';
}

function getKioskErrorMessage(error: any): string {
  const raw = error?.response?.data?.message;
  if (Array.isArray(raw)) return raw.join(' ');
  if (typeof raw === 'string') return raw;
  return 'No se pudo crear la orden. Intenta de nuevo.';
}

export default function App() {
  useSettingsLoader();
  const { screen, cart, reset, touch, setConfirmedOrder, orderType } = useKioskStore();
  const t = i18n.es;

  // Auto-reset por inactividad
  useEffect(() => {
    const handle = setInterval(() => {
      const inactive = Date.now() - useKioskStore.getState().lastActivityAt;
      if (inactive >= INACTIVITY_MS && screen !== 'WELCOME' && screen !== 'CONFIRMATION') {
        reset();
      }
    }, 5000);
    return () => clearInterval(handle);
  }, [screen, reset]);

  // Pre-carga datos del menú para kiosco (sin auth requerido)
  const { data: kioskMenu } = useQuery({
    queryKey: ['kiosk-menu', BRANCH_ID],
    queryFn: () => api.get(`/kiosk/${BRANCH_ID}/menu`).then((r) => r.data),
    enabled: !!BRANCH_ID,
    staleTime: 5 * 60_000,
  });

  const activeBranchLabel = kioskMenu?.branch?.name || (BRANCH_ID ? `Sucursal ${BRANCH_ID.slice(0, 8)}` : 'Sucursal no configurada');

  const placeOrder = useMutation({
    mutationFn: (_paymentMethod: 'CARD' | 'CASH') =>
      api
        .post(
          `/kiosk/${BRANCH_ID}/orders`,
          {
            type: mapKioskOrderType(useKioskStore.getState().orderType),
            customerId: useKioskStore.getState().customer?.id ?? undefined,
            items: cart.map((i) => ({
              productId: i.productId,
              productName: i.productName,
              unitPrice: i.price,
              quantity: i.quantity,
              notes: i.notes,
              modifiers: i.modifiers.map((m) => ({
                modifierOptionId: m.modifierOptionId,
                optionName: m.optionName,
                extraPrice: m.extraPrice,
              })),
            })),
          },
          { headers: { 'X-Silent-Error': '1' } },
        )
        .then((r) => r.data),
    onSuccess: (data) => setConfirmedOrder({
      orderNumber: String(data.orderNumber),
      message: data.message,
      tableNumber: data.tableNumber ?? null,
    }),
  });

  const screenMap: Record<typeof screen, React.ReactNode> = {
    WELCOME: <WelcomeScreen t={t} />,
    CUSTOMER: <CustomerScreen />,
    ORDER_TYPE: <OrderTypeScreen t={t} />,
    MENU: <MenuScreen t={t} branchId={BRANCH_ID} />,
    PRODUCT_DETAIL: <ProductDetailScreen t={t} branchId={BRANCH_ID} />,
    CART: <CartScreen t={t} isPending={placeOrder.isPending} />,
    PAYMENT: (
      <PaymentScreen
        t={t}
        onPayment={(method) => placeOrder.mutate(method)}
        isPending={placeOrder.isPending}
        paymentError={placeOrder.isError ? getKioskErrorMessage(placeOrder.error) : ''}
        orderType={orderType}
      />
    ),
    CONFIRMATION: <ConfirmationScreen t={t} onReset={reset} />,
  };

  return (
    <div className="w-full h-full relative" onClick={touch} onTouchStart={touch}>
      <div className="fixed top-3 right-3 z-50 pointer-events-none">
        <div className="rounded-full border border-white/25 bg-black/55 backdrop-blur px-3 py-1.5 text-xs text-white shadow-lg">
          <span className="mr-1.5">🏢</span>
          <span className="font-semibold">{activeBranchLabel}</span>
        </div>
      </div>
      {screenMap[screen]}
    </div>
  );
}
