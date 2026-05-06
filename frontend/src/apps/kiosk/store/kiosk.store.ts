import { create } from 'zustand';

export type KioskScreen =
  | 'WELCOME'
  | 'CUSTOMER'
  | 'ORDER_TYPE'
  | 'MENU'
  | 'PRODUCT_DETAIL'
  | 'CART'
  | 'PAYMENT'
  | 'CONFIRMATION';

export interface KioskCustomer {
  id: string;
  code: string;
  name: string;
  loyaltyPoints: number;
}

export interface CartItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  notes?: string;
  modifiers: { modifierOptionId: string; optionName: string; extraPrice: number }[];
}

interface KioskState {
  screen: KioskScreen;
  orderType: 'DINE_IN' | 'TO_GO' | null;
  customer: KioskCustomer | null;
  cart: CartItem[];
  selectedProductId: string | null;
  confirmedOrderNumber: string | null;
  lastActivityAt: number;

  goTo: (screen: KioskScreen) => void;
  setOrderType: (type: 'DINE_IN' | 'TO_GO') => void;
  setCustomer: (customer: KioskCustomer | null) => void;
  selectProduct: (id: string) => void;
  addToCart: (item: CartItem) => void;
  removeFromCart: (productId: string) => void;
  setConfirmedOrder: (orderNumber: string) => void;
  reset: () => void;
  touch: () => void;
}

const INITIAL: Pick<KioskState, 'screen' | 'orderType' | 'customer' | 'cart' | 'selectedProductId' | 'confirmedOrderNumber' | 'lastActivityAt'> = {
  screen: 'WELCOME',
  orderType: null,
  customer: null,
  cart: [],
  selectedProductId: null,
  confirmedOrderNumber: null,
  lastActivityAt: Date.now(),
};

export const useKioskStore = create<KioskState>((set) => ({
  ...INITIAL,

  goTo: (screen) => set({ screen, lastActivityAt: Date.now() }),
  setOrderType: (orderType) => set({ orderType, screen: 'MENU', lastActivityAt: Date.now() }),
  setCustomer: (customer) => set({ customer, screen: 'ORDER_TYPE', lastActivityAt: Date.now() }),
  selectProduct: (selectedProductId) => set({ selectedProductId, screen: 'PRODUCT_DETAIL', lastActivityAt: Date.now() }),

  addToCart: (item) =>
    set((s) => {
      const existing = s.cart.find((i) => i.productId === item.productId);
      const cart = existing
        ? s.cart.map((i) => i.productId === item.productId ? { ...i, quantity: i.quantity + item.quantity } : i)
        : [...s.cart, item];
      return { cart, screen: 'MENU', lastActivityAt: Date.now() };
    }),

  removeFromCart: (productId) =>
    set((s) => ({ cart: s.cart.filter((i) => i.productId !== productId), lastActivityAt: Date.now() })),

  setConfirmedOrder: (confirmedOrderNumber) =>
    set({ confirmedOrderNumber, screen: 'CONFIRMATION', lastActivityAt: Date.now() }),

  reset: () => set({ ...INITIAL, lastActivityAt: Date.now() }),
  touch: () => set({ lastActivityAt: Date.now() }),
}));
