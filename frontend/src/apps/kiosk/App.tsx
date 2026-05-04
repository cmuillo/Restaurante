import { useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../../lib/api';
import { useKioskStore } from './store/kiosk.store';
import { i18n } from './i18n/strings';
import WelcomeScreen from './screens/WelcomeScreen';
import LanguageScreen from './screens/LanguageScreen';
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

export default function App() {
  const { screen, language, cart, reset, touch, setConfirmedOrder } = useKioskStore();
  const t = i18n[language] as typeof i18n.es;

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
  useQuery({
    queryKey: ['kiosk-menu', BRANCH_ID],
    queryFn: () => api.get(`/kiosk/${BRANCH_ID}/menu`).then((r) => r.data),
    enabled: !!BRANCH_ID,
    staleTime: 5 * 60_000,
  });

  const placeOrder = useMutation({
    mutationFn: (paymentMethod: 'CARD' | 'CASH') =>
      api.post(`/kiosk/${BRANCH_ID}/orders`, {
        branchId: BRANCH_ID,
        type: useKioskStore.getState().orderType,
        paymentMethod,
        items: cart.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          notes: i.notes,
          modifiers: i.modifiers.map((m) => ({ modifierOptionId: m.modifierOptionId })),
        })),
      }),
    onSuccess: (res) => setConfirmedOrder(res.data.orderNumber),
  });

  const screenMap: Record<typeof screen, React.ReactNode> = {
    WELCOME: <WelcomeScreen t={t} />,
    LANGUAGE: <LanguageScreen />,
    ORDER_TYPE: <OrderTypeScreen t={t} />,
    MENU: <MenuScreen t={t} branchId={BRANCH_ID} />,
    PRODUCT_DETAIL: <ProductDetailScreen t={t} branchId={BRANCH_ID} />,
    CART: <CartScreen t={t} isPending={placeOrder.isPending} />,
    PAYMENT: <PaymentScreen t={t} onPayment={(method) => placeOrder.mutate(method)} isPending={placeOrder.isPending} />,
    CONFIRMATION: <ConfirmationScreen t={t} onReset={reset} />,
  };

  return (
    <div className="w-full h-full" onClick={touch} onTouchStart={touch}>
      {screenMap[screen]}
    </div>
  );
}
