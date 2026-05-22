import { useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useWaiterStore } from './store/waiter.store';
import waiterApi from './lib/waiter-api';
import { useSettingsLoader, useSettings } from '../../hooks/useSettings';

import LoginScreen from './screens/LoginScreen';
import TablesScreen from './screens/TablesScreen';
import CustomerScreen from './screens/CustomerScreen';
import MenuScreen from './screens/MenuScreen';
import ProductDetailScreen from './screens/ProductDetailScreen';
import CartScreen from './screens/CartScreen';
import ConfirmationScreen from './screens/ConfirmationScreen';

interface MenuData {
  branchConfig: { taxPercentage: number; tipPercentage: number };
}

export default function App() {
  useSettingsLoader();
  const settings = useSettings();

  const {
    screen,
    user,
    cart,
    selectedTable,
    customer,
    orderType,
    setConfirmedOrder,
  } = useWaiterStore();

  const branchId = user?.branchId ?? '';

  const { data: menu } = useQuery<MenuData>({
    queryKey: ['waiter-menu', branchId],
    queryFn: () => waiterApi.get(`/waiter/${branchId}/menu`).then((r) => r.data),
    enabled: !!branchId,
  });

  const taxPercentage = menu?.branchConfig?.taxPercentage ?? 13;
  const tipPercentage = settings.tipsEnabled && user?.role === 'waiter' ? (settings.tipPercentage ?? 10) : 0;

  const placeMutation = useMutation<unknown, Error, string>({
    mutationFn: async (notes: string) => {
      const items = cart.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        unitPrice: item.price,
        quantity: item.quantity,
        notes: item.notes,
        modifiers: item.modifiers.map((m) => ({
          modifierOptionId: m.modifierOptionId,
          optionName: m.optionName,
          extraPrice: m.extraPrice,
        })),
      }));

      const res = await waiterApi.post('/waiter/orders', {
        branchId,
        type: orderType,
        tableId: selectedTable?.id || undefined,
        customerId: customer?.id || undefined,
        notes: notes || undefined,
        taxPercentage,
        tipPercentage: tipPercentage > 0 ? tipPercentage : undefined,
        items,
      });
      return res.data;
    },
    onSuccess: (data: any) => {
      setConfirmedOrder(String(data.orderNumber), data.id);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Error desconocido';
      alert(`Error al enviar la orden: ${Array.isArray(msg) ? msg.join('\n') : msg}`);
    },
  });

  useEffect(() => {
    const handler = (e: Event) => {
      const notes = (e as CustomEvent<{ notes: string }>).detail?.notes ?? '';
      placeMutation.mutate(notes);
    };
    window.addEventListener('waiter:submit-order', handler);
    return () => window.removeEventListener('waiter:submit-order', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, branchId, orderType, selectedTable, customer, taxPercentage, tipPercentage]);

  return (
    <div className="flex flex-col min-h-screen">
      {screen === 'LOGIN' && <LoginScreen />}
      {screen === 'TABLES' && <TablesScreen />}
      {screen === 'CUSTOMER' && <CustomerScreen />}
      {screen === 'MENU' && <MenuScreen />}
      {screen === 'PRODUCT_DETAIL' && <ProductDetailScreen />}
      {screen === 'CART' && <CartScreen isPending={placeMutation.isPending} />}
      {screen === 'CONFIRMATION' && <ConfirmationScreen />}
    </div>
  );
}
