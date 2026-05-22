import { create } from 'zustand';

export type WaiterScreen =
  | 'LOGIN'
  | 'TABLES'
  | 'CUSTOMER'
  | 'MENU'
  | 'PRODUCT_DETAIL'
  | 'CART'
  | 'CONFIRMATION';

export interface WaiterUser {
  id: string;
  name: string;
  email: string;
  role: string;
  branchId: string;
}

export interface WaiterTable {
  id: string;
  number: number;
  name: string | null;
  capacity: number;
  status: string;
}

export interface CartItem {
  productId: string;
  productName: string;
  price: number;       // precio BASE sin IVA
  taxRate: number;
  quantity: number;
  notes?: string;
  modifiers: { modifierOptionId: string; optionName: string; extraPrice: number }[];
}

export interface WaiterCustomer {
  id: string;
  code: string;
  name: string;
  loyaltyPoints: number;
  isExempt?: boolean;
}

interface WaiterState {
  // Auth
  token: string | null;
  user: WaiterUser | null;

  // Navegación
  screen: WaiterScreen;

  // Contexto de mesa y orden
  selectedTable: WaiterTable | null;
  orderType: 'dine_in' | 'takeout';

  // Cliente
  customer: WaiterCustomer | null;

  // Carrito
  cart: CartItem[];
  selectedProductId: string | null;

  // Confirmación
  confirmedOrderNumber: string | null;
  confirmedOrderId: string | null;

  // Acciones
  login: (token: string, user: WaiterUser) => void;
  logout: () => void;
  goTo: (screen: WaiterScreen) => void;
  selectTable: (table: WaiterTable) => void;
  setOrderType: (type: 'dine_in' | 'takeout') => void;
  setCustomer: (customer: WaiterCustomer | null) => void;
  selectProduct: (id: string) => void;
  addToCart: (item: CartItem) => void;
  updateCartQty: (productId: string, qty: number) => void;
  removeFromCart: (productId: string) => void;
  setConfirmedOrder: (orderNumber: string, orderId: string) => void;
  reset: () => void;
}

function decodeJwtPayload(token: string): WaiterUser | null {
  try {
    // base64url → base64 estándar
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(b64));
    return {
      id: payload.sub,
      name: payload.name ?? payload.email,
      email: payload.email,
      role: payload.role,
      branchId: payload.branchId,
    };
  } catch {
    return null;
  }
}

const storedToken = localStorage.getItem('waiter_token');
const storedUser = storedToken ? decodeJwtPayload(storedToken) : null;

export const useWaiterStore = create<WaiterState>((set) => ({
  token: storedToken,
  user: storedUser,
  screen: storedToken && storedUser ? 'TABLES' : 'LOGIN',

  selectedTable: null,
  orderType: 'dine_in',

  customer: null,
  cart: [],
  selectedProductId: null,
  confirmedOrderNumber: null,
  confirmedOrderId: null,

  login: (token, user) => {
    localStorage.setItem('waiter_token', token);
    set({ token, user, screen: 'TABLES' });
  },

  logout: () => {
    localStorage.removeItem('waiter_token');
    set({
      token: null, user: null, screen: 'LOGIN',
      selectedTable: null, cart: [], customer: null,
    });
  },

  goTo: (screen) => set({ screen }),

  selectTable: (table) =>
    set({
      selectedTable: table,
      orderType: 'dine_in',
      cart: [],
      customer: null,
    }),

  setOrderType: (orderType) => set({ orderType }),

  setCustomer: (customer) => set({ customer }),

  selectProduct: (selectedProductId) => set({ selectedProductId, screen: 'PRODUCT_DETAIL' }),

  addToCart: (item) =>
    set((s) => {
      const existing = s.cart.find(
        (c) =>
          c.productId === item.productId &&
          JSON.stringify(c.modifiers) === JSON.stringify(item.modifiers),
      );
      if (existing) {
        return {
          cart: s.cart.map((c) =>
            c === existing ? { ...c, quantity: c.quantity + item.quantity } : c,
          ),
        };
      }
      return { cart: [...s.cart, item] };
    }),

  updateCartQty: (productId, qty) =>
    set((s) => ({
      cart:
        qty <= 0
          ? s.cart.filter((c) => c.productId !== productId)
          : s.cart.map((c) => (c.productId === productId ? { ...c, quantity: qty } : c)),
    })),

  removeFromCart: (productId) =>
    set((s) => ({ cart: s.cart.filter((c) => c.productId !== productId) })),

  setConfirmedOrder: (confirmedOrderNumber, confirmedOrderId) =>
    set({ confirmedOrderNumber, confirmedOrderId, screen: 'CONFIRMATION' }),

  reset: () =>
    set({
      screen: 'TABLES',
      selectedTable: null,
      orderType: 'dine_in',
      customer: null,
      cart: [],
      selectedProductId: null,
      confirmedOrderNumber: null,
      confirmedOrderId: null,
    }),
}));
