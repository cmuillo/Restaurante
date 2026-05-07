import { useEffect, useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Branch {
  id: string;
  name: string;
}

interface HaciendaConfig {
  haciendaEnabled: boolean;
  haciendaTaxIdType: string;
  haciendaTaxId: string;
  haciendaIdpUrl: string;
  haciendaApiUrl: string;
  haciendaClientId: string;
  haciendaUsername: string;
  haciendaPassword: string | null;
  haciendaProvince: string;
  haciendaCanton: string;
  haciendaDistrict: string;
  haciendaBranchCode: string;
  haciendaTerminalCode: string;
  haciendaP12Password: string | null;
  haciendaEnvironment: string;
  haciendaP12Loaded: boolean;
}

interface InvoiceStatus {
  id: string;
  invoiceNumber: string;
  total: number;
  haciendaKey: string;
  haciendaDocType: string;
  haciendaStatus: string;
  haciendaMessage: string | null;
  haciendaProcessedAt: string | null;
  createdAt: string;
}

// ─── URLs por defecto ────────────────────────────────────────────────────────
const SANDBOX_IDP = 'https://idp.comprobanteselectronicos.go.cr/auth/realms/rut-stag/protocol/openid-connect/token';
const SANDBOX_API = 'https://api-sandbox.comprobanteselectronicos.go.cr/recepcion/v1';
const PROD_IDP    = 'https://idp.comprobanteselectronicos.go.cr/auth/realms/rut/protocol/openid-connect/token';
const PROD_API    = 'https://api.comprobanteselectronicos.go.cr/recepcion/v1';

// ─── Badge de estado ─────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending:    { label: 'Pendiente',   cls: 'bg-yellow-100 text-yellow-700' },
    sending:    { label: 'Enviando',    cls: 'bg-blue-100 text-blue-700' },
    sent:       { label: 'Enviado',     cls: 'bg-cyan-100 text-cyan-700' },
    accepted:   { label: 'Aceptado',    cls: 'bg-green-100 text-green-700' },
    rejected:   { label: 'Rechazado',   cls: 'bg-red-100 text-red-700' },
    error:      { label: 'Error',       cls: 'bg-red-100 text-red-700' },
    contingency:{ label: 'Contingencia',cls: 'bg-orange-100 text-orange-700' },
  };
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function HaciendaConfigPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'emisor' | 'credenciales' | 'certificado' | 'estado'>('emisor');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Queries ─────────────────────────────────────────────────────────────

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: () => api.get('/branches').then((r) => r.data),
  });

  const { data: cfg, isLoading: cfgLoading } = useQuery<HaciendaConfig>({
    queryKey: ['hacienda-config', selectedBranch],
    queryFn: () => api.get('/hacienda/config', { params: { branchId: selectedBranch } }).then((r) => r.data),
    enabled: !!selectedBranch,
  });

  const { data: statuses = [], refetch: refetchStatuses } = useQuery<InvoiceStatus[]>({
    queryKey: ['hacienda-status', selectedBranch],
    queryFn: () => api.get('/hacienda/status', { params: { branchId: selectedBranch, limit: 50 } }).then((r) => r.data),
    enabled: !!selectedBranch && tab === 'estado',
    refetchInterval: tab === 'estado' ? 15_000 : false,
  });

  // ─── Mutations ────────────────────────────────────────────────────────────

  const updateMut = useMutation({
    mutationFn: (data: Partial<HaciendaConfig>) =>
      api.put('/hacienda/config', data, { params: { branchId: selectedBranch } }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hacienda-config', selectedBranch] }),
  });

  const uploadMut = useMutation({
    mutationFn: (formData: FormData) =>
      api.post('/hacienda/certificate', formData, {
        params: { branchId: selectedBranch },
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hacienda-config', selectedBranch] }),
  });

  const resendMut = useMutation({
    mutationFn: (invoiceId: string) =>
      api.post(`/hacienda/invoices/${invoiceId}/resend`, null, { params: { branchId: selectedBranch } }).then((r) => r.data),
    onSuccess: () => setTimeout(() => refetchStatuses(), 3000),
  });

  useEffect(() => {
    if (!selectedBranch && branches.length > 0) {
      setSelectedBranch(branches[0].id);
    }
  }, [selectedBranch, branches]);

  // ─── Formulario de emisor ─────────────────────────────────────────────────
  function EmisorTab() {
    const [form, setForm] = useState({
      haciendaEnabled:   cfg?.haciendaEnabled   ?? false,
      haciendaTaxIdType: cfg?.haciendaTaxIdType ?? '02',
      haciendaTaxId:     cfg?.haciendaTaxId     ?? '',
      haciendaProvince:  cfg?.haciendaProvince  ?? '01',
      haciendaCanton:    cfg?.haciendaCanton    ?? '01',
      haciendaDistrict:  cfg?.haciendaDistrict  ?? '01',
      haciendaBranchCode:   cfg?.haciendaBranchCode   ?? '001',
      haciendaTerminalCode: cfg?.haciendaTerminalCode ?? '00001',
    });

    return (
      <form
        onSubmit={(e) => { e.preventDefault(); updateMut.mutate(form); }}
        className="space-y-6 max-w-xl"
      >
        {/* Habilitado */}
        <label className="flex items-center gap-3 cursor-pointer">
          <div className="relative">
            <input
              type="checkbox"
              className="sr-only"
              checked={form.haciendaEnabled}
              onChange={(e) => setForm({ ...form, haciendaEnabled: e.target.checked })}
            />
            <div className={`w-11 h-6 rounded-full transition-colors ${form.haciendaEnabled ? 'bg-brand-600' : 'bg-gray-300'}`} />
            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.haciendaEnabled ? 'translate-x-5' : ''}`} />
          </div>
          <span className="font-medium text-gray-800">Facturación electrónica habilitada</span>
        </label>

        {/* Cédula */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de identificación</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.haciendaTaxIdType}
              onChange={(e) => setForm({ ...form, haciendaTaxIdType: e.target.value })}
            >
              <option value="01">01 — Física</option>
              <option value="02">02 — Jurídica</option>
              <option value="03">03 — DIMEX</option>
              <option value="04">04 — NITE</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Número de cédula / RUC</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Sin guiones"
              value={form.haciendaTaxId}
              onChange={(e) => setForm({ ...form, haciendaTaxId: e.target.value })}
            />
          </div>
        </div>

        {/* Ubicación (tablas Hacienda) */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Ubicación del emisor</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Provincia</label>
              <input
                maxLength={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.haciendaProvince}
                onChange={(e) => setForm({ ...form, haciendaProvince: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Cantón</label>
              <input
                maxLength={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.haciendaCanton}
                onChange={(e) => setForm({ ...form, haciendaCanton: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Distrito</label>
              <input
                maxLength={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.haciendaDistrict}
                onChange={(e) => setForm({ ...form, haciendaDistrict: e.target.value })}
              />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Códigos de 2 dígitos según tablas del Ministerio de Hacienda (ej. Provincia 01 = San José)
          </p>
        </div>

        {/* Sucursal y terminal */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código de sucursal (3 dígitos)</label>
            <input
              maxLength={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.haciendaBranchCode}
              onChange={(e) => setForm({ ...form, haciendaBranchCode: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código de terminal (5 dígitos)</label>
            <input
              maxLength={5}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.haciendaTerminalCode}
              onChange={(e) => setForm({ ...form, haciendaTerminalCode: e.target.value })}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={updateMut.isPending}
          className="px-5 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
        >
          {updateMut.isPending ? 'Guardando…' : 'Guardar datos del emisor'}
        </button>

        {updateMut.isSuccess && <p className="text-sm text-green-600">✓ Guardado correctamente</p>}
        {updateMut.isError   && <p className="text-sm text-red-600">Error al guardar</p>}
      </form>
    );
  }

  // ─── Formulario de credenciales ATV ──────────────────────────────────────
  function CredencialesTab() {
    const isSandbox = (cfg?.haciendaEnvironment ?? 'sandbox') === 'sandbox';
    const [form, setForm] = useState({
      haciendaEnvironment: cfg?.haciendaEnvironment ?? 'sandbox',
      haciendaClientId:    cfg?.haciendaClientId   ?? (isSandbox ? 'api-stag' : 'api'),
      haciendaUsername:    cfg?.haciendaUsername   ?? '',
      haciendaPassword:    '',  // nunca mostramos la contraseña real
      haciendaIdpUrl:      cfg?.haciendaIdpUrl    ?? (isSandbox ? SANDBOX_IDP : PROD_IDP),
      haciendaApiUrl:      cfg?.haciendaApiUrl    ?? (isSandbox ? SANDBOX_API : PROD_API),
    });

    function applyEnvironment(env: string) {
      const sandbox = env === 'sandbox';
      setForm({
        ...form,
        haciendaEnvironment: env,
        haciendaClientId: sandbox ? 'api-stag' : 'api',
        haciendaIdpUrl:   sandbox ? SANDBOX_IDP : PROD_IDP,
        haciendaApiUrl:   sandbox ? SANDBOX_API : PROD_API,
      });
    }

    const payload = { ...form };
    if (!payload.haciendaPassword) delete (payload as Partial<typeof payload>).haciendaPassword;

    return (
      <form
        onSubmit={(e) => { e.preventDefault(); updateMut.mutate(payload); }}
        className="space-y-5 max-w-xl"
      >
        {/* Ambiente */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Ambiente</p>
          <div className="flex gap-3">
            {(['sandbox', 'production'] as const).map((env) => (
              <button
                key={env}
                type="button"
                onClick={() => applyEnvironment(env)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  form.haciendaEnvironment === env
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {env === 'sandbox' ? '🧪 Sandbox (pruebas)' : '🚀 Producción'}
              </button>
            ))}
          </div>
          {form.haciendaEnvironment === 'production' && (
            <p className="mt-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2">
              ⚠️ En producción, los comprobantes emitidos son legalmente vinculantes y se notifican al cliente y a Hacienda.
            </p>
          )}
        </div>

        {/* Client ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={form.haciendaClientId}
            onChange={(e) => setForm({ ...form, haciendaClientId: e.target.value })}
          />
        </div>

        {/* Usuario ATV */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Usuario ATV</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.haciendaUsername}
              onChange={(e) => setForm({ ...form, haciendaUsername: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña ATV{cfg?.haciendaPassword ? ' (dejar en blanco = sin cambiar)' : ''}
            </label>
            <input
              type="password"
              autoComplete="new-password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder={cfg?.haciendaPassword ? '••••••••' : 'Ingresar contraseña'}
              value={form.haciendaPassword}
              onChange={(e) => setForm({ ...form, haciendaPassword: e.target.value })}
            />
          </div>
        </div>

        {/* URLs */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">URL IDP (OAuth2)</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono text-xs"
            value={form.haciendaIdpUrl}
            onChange={(e) => setForm({ ...form, haciendaIdpUrl: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">URL API de recepción</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono text-xs"
            value={form.haciendaApiUrl}
            onChange={(e) => setForm({ ...form, haciendaApiUrl: e.target.value })}
          />
        </div>

        <button
          type="submit"
          disabled={updateMut.isPending}
          className="px-5 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
        >
          {updateMut.isPending ? 'Guardando…' : 'Guardar credenciales'}
        </button>

        {updateMut.isSuccess && <p className="text-sm text-green-600">✓ Guardado correctamente</p>}
        {updateMut.isError   && <p className="text-sm text-red-600">Error al guardar</p>}
      </form>
    );
  }

  // ─── Formulario de certificado .p12 ──────────────────────────────────────
  function CertificadoTab() {
    const [p12Password, setP12Password] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [pwSaved, setPwSaved] = useState(false);

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
      setSelectedFile(e.target.files?.[0] ?? null);
    }

    function handleUpload(e: React.FormEvent) {
      e.preventDefault();
      if (!selectedFile) return;
      const fd = new FormData();
      fd.append('file', selectedFile);
      if (p12Password) fd.append('p12Password', p12Password);
      uploadMut.mutate(fd);
    }

    function savePw(e: React.FormEvent) {
      e.preventDefault();
      updateMut.mutate({ haciendaP12Password: p12Password });
      setPwSaved(true);
    }

    return (
      <div className="space-y-8 max-w-xl">
        {/* Estado actual */}
        <div className={`rounded-xl border p-4 ${cfg?.haciendaP12Loaded ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
          <p className="font-medium text-sm">
            {cfg?.haciendaP12Loaded ? '✅ Certificado cargado' : '⚠️ Sin certificado — modo contingencia activo'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {cfg?.haciendaP12Loaded
              ? 'El certificado de Firma Digital del BCCR está almacenado en el servidor.'
              : 'Suba su archivo .p12 emitido por el BCCR para habilitar la firma electrónica.'}
          </p>
        </div>

        {/* Contraseña del .p12 (guardar por separado si ya hay certificado) */}
        {cfg?.haciendaP12Loaded && (
          <form onSubmit={savePw} className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Contraseña del .p12{cfg?.haciendaP12Password ? ' (dejar en blanco = sin cambiar)' : ''}
            </label>
            <div className="flex gap-3">
              <input
                type="password"
                autoComplete="new-password"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder={cfg?.haciendaP12Password ? '••••••••' : 'Contraseña del certificado'}
                value={p12Password}
                onChange={(e) => { setP12Password(e.target.value); setPwSaved(false); }}
              />
              <button
                type="submit"
                disabled={updateMut.isPending || !p12Password}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                Actualizar
              </button>
            </div>
            {pwSaved && updateMut.isSuccess && <p className="text-xs text-green-600">✓ Contraseña actualizada</p>}
          </form>
        )}

        {/* Upload */}
        <form onSubmit={handleUpload} className="space-y-4">
          <p className="text-sm font-medium text-gray-700">
            {cfg?.haciendaP12Loaded ? 'Reemplazar certificado' : 'Subir certificado .p12'}
          </p>

          <div
            className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-brand-400 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".p12,.pfx"
              className="hidden"
              onChange={handleFileChange}
            />
            {selectedFile ? (
              <p className="text-sm text-brand-700 font-medium">📄 {selectedFile.name}</p>
            ) : (
              <>
                <p className="text-2xl mb-1">📁</p>
                <p className="text-sm text-gray-600">Haga clic para seleccionar el archivo .p12</p>
                <p className="text-xs text-gray-400 mt-1">Solo archivos .p12 o .pfx, máximo 5 MB</p>
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña del certificado
            </label>
            <input
              type="password"
              autoComplete="new-password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Contraseña asignada al generar el .p12"
              value={p12Password}
              onChange={(e) => setP12Password(e.target.value)}
              required={!cfg?.haciendaP12Loaded}
            />
          </div>

          <button
            type="submit"
            disabled={!selectedFile || uploadMut.isPending}
            className="px-5 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {uploadMut.isPending ? 'Subiendo…' : 'Subir certificado'}
          </button>

          {uploadMut.isSuccess && <p className="text-sm text-green-600">✓ Certificado cargado correctamente</p>}
          {uploadMut.isError   && <p className="text-sm text-red-600">Error al subir el certificado</p>}
        </form>
      </div>
    );
  }

  // ─── Tabla de estado de comprobantes ─────────────────────────────────────
  function EstadoTab() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Últimos 50 comprobantes enviados. Se actualiza cada 15 segundos.
          </p>
          <button
            onClick={() => refetchStatuses()}
            className="text-xs text-brand-600 hover:underline"
          >
            Actualizar ahora
          </button>
        </div>

        {statuses.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-3xl mb-2">🧾</p>
            <p>No hay comprobantes enviados aún</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full text-sm divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Factura</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clave</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Procesado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {statuses.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 text-xs uppercase text-gray-600">{inv.haciendaDocType}</td>
                    <td className="px-4 py-3 text-right font-medium">₡{Number(inv.total).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <StatusBadge status={inv.haciendaStatus} />
                        {inv.haciendaMessage && (
                          <p className="text-xs text-gray-400 max-w-xs truncate" title={inv.haciendaMessage}>
                            {inv.haciendaMessage}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400 truncate max-w-[12rem]" title={inv.haciendaKey}>
                      {inv.haciendaKey?.slice(0, 20)}…
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {inv.haciendaProcessedAt
                        ? new Date(inv.haciendaProcessedAt).toLocaleString('es-CR')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(inv.haciendaStatus === 'error' || inv.haciendaStatus === 'rejected') && (
                        <button
                          onClick={() => resendMut.mutate(inv.id)}
                          disabled={resendMut.isPending}
                          className="text-xs text-brand-600 hover:underline disabled:opacity-50"
                        >
                          Reenviar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const tabs = [
    { key: 'emisor',       label: 'Emisor' },
    { key: 'credenciales', label: 'Credenciales ATV' },
    { key: 'certificado',  label: 'Certificado Digital' },
    { key: 'estado',       label: 'Estado de comprobantes' },
  ] as const;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Facturación Electrónica — Hacienda CR</h2>
      <p className="text-sm text-gray-500 mb-6">Configure los datos del emisor, credenciales ATV y certificado de firma digital.</p>

      {/* Selector de sucursal */}
      <div className="mb-6 max-w-sm">
        <label className="block text-sm font-medium text-gray-700 mb-1">Sucursal</label>
        <select
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
        >
          <option value="">— Seleccionar sucursal —</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {!selectedBranch && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-3xl mb-2">🏢</p>
          <p>Seleccione una sucursal para ver su configuración de Hacienda</p>
        </div>
      )}

      {selectedBranch && cfgLoading && (
        <div className="text-center py-12 text-gray-400">Cargando configuración…</div>
      )}

      {selectedBranch && !cfgLoading && cfg && (
        <>
          {/* Tabs */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="flex gap-1">
              {tabs.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    tab === key
                      ? 'border-brand-600 text-brand-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>

          {/* Contenido del tab activo */}
          {tab === 'emisor'       && <EmisorTab />}
          {tab === 'credenciales' && <CredencialesTab />}
          {tab === 'certificado'  && <CertificadoTab />}
          {tab === 'estado'       && <EstadoTab />}
        </>
      )}
    </div>
  );
}
