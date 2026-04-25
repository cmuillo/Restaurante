import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth.store';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

export default function ReportsPage() {
  const { user } = useAuthStore();
  const branchId = user?.branchId ?? '';

  const today = new Date().toISOString().split('T')[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString().split('T')[0];

  const [from, setFrom] = useState(sevenDaysAgo);
  const [to, setTo] = useState(today);

  const { data: salesRange } = useQuery({
    queryKey: ['sales-range', branchId, from, to],
    queryFn: () =>
      api.get(`/reports/sales-by-range?branchId=${branchId}&from=${from}&to=${to}`).then((r) => r.data),
    enabled: !!branchId,
  });

  const { data: topProducts = [] } = useQuery({
    queryKey: ['top-products', branchId, from, to],
    queryFn: () =>
      api.get(`/reports/top-products?branchId=${branchId}&from=${from}&to=${to}&limit=10`).then((r) => r.data),
    enabled: !!branchId,
  });

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Reportes</h2>

      <div className="flex gap-4 mb-6">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
      </div>

      {salesRange?.dailyBreakdown?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h3 className="text-base font-semibold text-gray-800 mb-4">Ventas por día</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={salesRange.dailyBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `$${v}`} />
              <Line type="monotone" dataKey="total" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} name="Total" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {topProducts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-base font-semibold text-gray-800 mb-3">Productos más vendidos</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Producto</th>
                <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">Cantidad</th>
                <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {topProducts.map((p: { productId: string; productName: string; totalQuantity: number; totalRevenue: number }) => (
                <tr key={p.productId} className="hover:bg-gray-50">
                  <td className="py-2 font-medium text-gray-800">{p.productName}</td>
                  <td className="py-2 text-right text-gray-600">{p.totalQuantity}</td>
                  <td className="py-2 text-right font-medium text-brand-600">${Number(p.totalRevenue).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
