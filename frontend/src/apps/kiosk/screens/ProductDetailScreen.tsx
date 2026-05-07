import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';
import { useKioskStore } from '../store/kiosk.store';
import type { Strings } from '../i18n/strings';
import { useSettings } from '../../../hooks/useSettings';
import { formatCurrency } from '../../../stores/settings.store';

export default function ProductDetailScreen({ t, branchId }: { t: Strings; branchId: string }) {
  const { selectedProductId, addToCart, goTo } = useKioskStore();
  const settings = useSettings();
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string>>({});

  const { data: menu } = useQuery({
    queryKey: ['kiosk-menu', branchId],
    queryFn: () => api.get(`/kiosk/menu?branchId=${branchId}`).then((r) => r.data),
    enabled: !!branchId,
  });

  const product = menu?.products?.find((p: { id: string }) => p.id === selectedProductId);

  if (!product) return null;

  const modifiers: { id: string; name: string; type: string; required: boolean; options: { id: string; name: string; extraPrice: number }[] }[] =
    product.modifiers ?? [];

  const toggleModifier = (modifierId: string, optionId: string) => {
    setSelectedModifiers((prev) => ({ ...prev, [modifierId]: optionId }));
  };

  const extraPrice = Object.entries(selectedModifiers).reduce((sum, [modId, optId]) => {
    const mod = modifiers.find((m) => m.id === modId);
    const opt = mod?.options.find((o: { id: string }) => o.id === optId);
    return sum + (opt?.extraPrice ?? 0);
  }, 0);

  const taxRate: number = product.taxRate ?? 0;
  const baseUnitPrice = Number(product.price) + extraPrice;
  // Precio con IVA para mostrar al cliente
  const unitTotal = baseUnitPrice * (1 + taxRate / 100) * quantity;

  const handleAdd = () => {
    const modifiersList = Object.entries(selectedModifiers).map(([modId, optId]) => {
      const mod = modifiers.find((m) => m.id === modId)!;
      const opt = mod.options.find((o: { id: string }) => o.id === optId)!;
      return { modifierOptionId: optId, optionName: opt.name, extraPrice: opt.extraPrice };
    });
    addToCart({
      productId: product.id,
      productName: product.name,
      price: baseUnitPrice,  // base sin IVA (el backend lo usa para calcular el impuesto)
      taxRate,
      quantity,
      notes: notes.trim() || undefined,
      modifiers: modifiersList,
    });
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 bg-gray-800 border-b border-gray-700">
        <button onClick={() => goTo('MENU')} className="text-gray-400 hover:text-white text-2xl">←</button>
        <h2 className="text-2xl font-bold text-white truncate">{product.name}</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex gap-8">
        {/* Imagen + descripción */}
        <div className="w-72 flex-shrink-0">
          {product.imageUrl
            ? <img src={product.imageUrl} alt={product.name} className="w-full h-56 object-cover rounded-2xl mb-4" />
            : <div className="w-full h-56 bg-gray-800 rounded-2xl mb-4 flex items-center justify-center text-7xl">🍽️</div>}
          {product.description && <p className="text-gray-400 text-base">{product.description}</p>}
        </div>

        {/* Opciones + modificadores */}
        <div className="flex-1 space-y-6">
          {modifiers.map((mod) => (
            <div key={mod.id}>
              <p className="font-semibold text-white text-lg mb-3">
                {mod.name} {mod.required && <span className="text-red-400 text-sm">*</span>}
              </p>
              <div className="flex flex-wrap gap-3">
                {mod.options.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => toggleModifier(mod.id, opt.id)}
                    className={`px-5 py-3 rounded-2xl text-base font-medium transition-all ${
                      selectedModifiers[mod.id] === opt.id
                        ? 'bg-brand-600 text-white border-2 border-brand-400'
                        : 'bg-gray-800 text-gray-300 border-2 border-gray-700 hover:border-gray-500'
                    }`}
                  >
                    {opt.name}
                    {opt.extraPrice > 0 && <span className="ml-1 text-brand-300">+{formatCurrency(opt.extraPrice, settings)}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Notas */}
          <div>
            <p className="font-semibold text-white text-lg mb-2">Notas (opcional)</p>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={200}
              placeholder="Sin cebolla, extra salsa…"
              className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 text-base"
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-5 bg-gray-800 border-t border-gray-700 flex items-center gap-6">
        <div className="flex items-center gap-4 bg-gray-700 rounded-2xl px-4 py-2">
          <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="text-2xl font-bold text-white w-10 h-10 flex items-center justify-center hover:text-brand-400">−</button>
          <span className="text-2xl font-bold text-white w-10 text-center">{quantity}</span>
          <button onClick={() => setQuantity((q) => q + 1)} className="text-2xl font-bold text-white w-10 h-10 flex items-center justify-center hover:text-brand-400">+</button>
        </div>
        <button
          onClick={handleAdd}
          className="flex-1 py-5 bg-brand-600 hover:bg-brand-500 active:scale-95 rounded-2xl font-bold text-xl text-white transition-all"
        >
          {t.addToOrder} — {formatCurrency(unitTotal, settings)}
        </button>
      </div>
    </div>
  );
}
