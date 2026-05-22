import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import waiterApi from '../lib/waiter-api';
import { useWaiterStore } from '../store/waiter.store';
import { useSettings } from '../../../hooks/useSettings';
import { formatCurrency } from '../../../stores/settings.store';

interface ModifierOption {
  id: string;
  name: string;
  extraPrice: string;
}

interface Modifier {
  id: string;
  name: string;
  required: boolean;
  maxSelections: number;
  options: ModifierOption[];
}

interface ProductDetail {
  id: string;
  name: string;
  description: string | null;
  price: string;
  imageBase64: string | null;
  taxRate: number;
  modifiers: Modifier[];
}

interface MenuData {
  products: ProductDetail[];
}

export default function ProductDetailScreen() {
  const { user, selectedProductId, addToCart, goTo } = useWaiterStore();
  const settings = useSettings();
  const branchId = user?.branchId ?? '';

  const { data: menu } = useQuery<MenuData>({
    queryKey: ['waiter-menu', branchId],
    queryFn: () => waiterApi.get(`/waiter/${branchId}/menu`).then((r) => r.data),
    enabled: !!branchId,
  });

  const product = useMemo(() => {
    if (!menu) return null;
    return menu.products.find((p) => p.id === selectedProductId) ?? null;
  }, [menu, selectedProductId]);

  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!product) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-400">Cargando…</p>
      </div>
    );
  }

  const salePriceBase = parseFloat(product.price); // precio de venta con IVA
  const taxRate = product.taxRate ?? 0;

  const modifierTotal = Object.entries(selectedOptions).reduce((total, [, opts]) => {
    return (
      total +
      opts.reduce((s, optId) => {
        for (const g of product.modifiers ?? []) {
          const found = g.options.find((o) => o.id === optId);
          if (found) return s + parseFloat(String(found.extraPrice));
        }
        return s;
      }, 0)
    );
  }, 0);

  // product.price ya incluye IVA; los extras de modificadores también se suman al precio con IVA
  const salePriceUnit = salePriceBase + modifierTotal;
  // precio base sin IVA para enviar al backend y almacenar en el carrito
  const baseUnitPrice = taxRate > 0 ? salePriceUnit / (1 + taxRate / 100) : salePriceUnit;
  const displayPrice = salePriceUnit * qty;

  const toggleOption = (groupId: string, optionId: string, maxSelectable: number) => {
    setSelectedOptions((prev) => {
      const current = prev[groupId] ?? [];
      if (current.includes(optionId)) {
        return { ...prev, [groupId]: current.filter((id) => id !== optionId) };
      }
      if (maxSelectable === 1) {
        return { ...prev, [groupId]: [optionId] };
      }
      if (current.length < maxSelectable) {
        return { ...prev, [groupId]: [...current, optionId] };
      }
      return prev;
    });
    setErrors((prev) => ({ ...prev, [groupId]: '' }));
  };

  const handleAddToCart = () => {
    const newErrors: Record<string, string> = {};
    for (const group of product.modifiers ?? []) {
      if (group.required && !(selectedOptions[group.id]?.length)) {
        newErrors[group.id] = `Selecciona una opción de ${group.name}`;
      }
    }
    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }

    const modifiers = Object.entries(selectedOptions).flatMap(([groupId, optIds]) => {
      const group = product.modifiers?.find((g: Modifier) => g.id === groupId);
      return optIds.map((optId) => {
        const opt = group?.options.find((o: ModifierOption) => o.id === optId);
        return {
          modifierOptionId: optId,
          optionName: opt?.name ?? '',
          extraPrice: parseFloat(String(opt?.extraPrice ?? '0')),
        };
      });
    });

    addToCart({
      productId: product.id,
      productName: product.name,
      price: baseUnitPrice,  // base sin IVA
      taxRate,
      quantity: qty,
      notes: notes.trim() || undefined,
      modifiers,
    });

    goTo('MENU');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {/* Header con imagen */}
      <div className="relative">
        {product.imageBase64 ? (
          <img
            src={product.imageBase64}
            alt={product.name}
            className="w-full h-48 object-cover"
          />
        ) : (
          <div className="w-full h-32 bg-gray-100 flex items-center justify-center text-5xl">
            🍽️
          </div>
        )}
        <button
          onClick={() => goTo('MENU')}
          className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 hover:bg-black/75 active:scale-95 text-white text-sm font-semibold backdrop-blur-sm transition-all"
        >
          ‹ Volver
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-32 flex flex-col gap-5">
        {/* Nombre y descripción */}
        <div>
          <h2 className="text-xl font-black text-gray-900">{product.name}</h2>
          {product.description && (
            <p className="text-sm text-gray-500 mt-1">{product.description}</p>
          )}
        </div>

        {/* Modificadores */}
        {(product.modifiers ?? []).map((group) => (
          <div key={group.id} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-800 text-sm">{group.name}</h3>
              {group.required && (
                <span className="text-xs bg-red-100 text-red-600 rounded-full px-2 py-0.5 font-semibold">
                  Requerido
                </span>
              )}
            </div>
            {errors[group.id] && (
              <p className="text-xs text-red-500">{errors[group.id]}</p>
            )}
            <div className="flex flex-col gap-1.5">
              {group.options.map((opt) => {
                const selected = (selectedOptions[group.id] ?? []).includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    onClick={() => toggleOption(group.id, opt.id, group.maxSelections)}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all active:scale-95 ${
                      selected
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <span className="text-sm font-medium text-gray-800">{opt.name}</span>
                    <div className="flex items-center gap-2">
                      {parseFloat(opt.extraPrice) > 0 && (
                        <span className="text-xs text-gray-500">
                          +{formatCurrency(parseFloat(opt.extraPrice), settings)}
                        </span>
                      )}
                      <span
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          selected ? 'border-brand-500 bg-brand-500' : 'border-gray-300'
                        }`}
                      >
                        {selected && <span className="text-white text-xs">✓</span>}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Notas */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Notas (opcional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: sin cebolla, término 3/4…"
            rows={2}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />
        </div>
      </div>

      {/* Barra inferior */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 flex items-center gap-3">
        {/* Stepper cantidad */}
        <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-1 py-1">
          <button
            onClick={() => setQty(Math.max(1, qty - 1))}
            className="w-9 h-9 rounded-lg bg-white flex items-center justify-center text-lg font-bold shadow-sm active:scale-90 transition-all"
          >
            −
          </button>
          <span className="text-base font-black w-6 text-center">{qty}</span>
          <button
            onClick={() => setQty(qty + 1)}
            className="w-9 h-9 rounded-lg bg-white flex items-center justify-center text-lg font-bold shadow-sm active:scale-90 transition-all"
          >
            +
          </button>
        </div>
        <button
          onClick={handleAddToCart}
          className="flex-1 bg-brand-600 hover:bg-brand-500 active:scale-95 text-white font-bold rounded-2xl py-4 flex items-center justify-between px-5 transition-all"
        >
          <span>Agregar al pedido</span>
          <span>{formatCurrency(displayPrice, settings)}</span>
        </button>
      </div>
    </div>
  );
}
