import { useRef, useState, useEffect, useCallback } from 'react';
import jsQR from 'jsqr';
import { useMutation } from '@tanstack/react-query';
import api from '../../../lib/api';
import { useKioskStore, type KioskCustomer } from '../store/kiosk.store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CustomerData {
  id: string;
  code: string;
  name: string;
  loyaltyPoints: number;
  isExempt?: boolean;
}

type QrStatus = 'idle' | 'starting' | 'scanning' | 'found' | 'error';
type View = 'main' | 'scanning' | 'confirm' | 'register';

export default function CustomerScreen() {
  const { setCustomer } = useKioskStore();

  // QR camera
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [view, setView] = useState<View>('main');
  const [qrStatus, setQrStatus] = useState<QrStatus>('idle');
  const [foundCustomer, setFoundCustomer] = useState<CustomerData | null>(null);
  const [qrError, setQrError] = useState('');

  // Register modal state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regDone, setRegDone] = useState(false);
  const [regMessage, setRegMessage] = useState('');
  const [registeredCustomer, setRegisteredCustomer] = useState<KioskCustomer | null>(null);
  const [registeredCode, setRegisteredCode] = useState('');
  const [registeredQr, setRegisteredQr] = useState('');

  // ---------------------------------------------------------------------------
  // Camera helpers
  // ---------------------------------------------------------------------------
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  const startCamera = async () => {
    setView('scanning');
    setQrError('');
    setQrStatus('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setQrStatus('scanning');
    } catch {
      setQrStatus('error');
      setQrError('No se pudo acceder a la cámara. Verifique los permisos.');
    }
  };

  // Attach stream to video once the scanning view is active
  useEffect(() => {
    if (view !== 'scanning' || !streamRef.current) return;
    const video = videoRef.current;
    if (!video) return;

    video.srcObject = streamRef.current;
    video.muted = true;
    video.play().then(() => {
      setQrStatus('scanning');
      scanLoop();
    }).catch(() => setQrStatus('error'));
  }, [view, qrStatus]);

  const scanLoop = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const frame = () => {
      if (!streamRef.current || video.readyState < 2 || !video.videoWidth) {
        animFrameRef.current = requestAnimationFrame(frame);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code) {
        stopCamera();
        setQrStatus('found');
        lookupCustomer.mutate(code.data);
        return;
      }
      animFrameRef.current = requestAnimationFrame(frame);
    };
    animFrameRef.current = requestAnimationFrame(frame);
  };

  useEffect(() => () => stopCamera(), [stopCamera]);

  // ---------------------------------------------------------------------------
  // Customer lookup
  // ---------------------------------------------------------------------------
  const lookupCustomer = useMutation({
    mutationFn: (code: string) =>
      api.get(`/kiosk/customers/code/${encodeURIComponent(code)}`).then((r) => r.data as CustomerData),
    onSuccess: (data) => {
      setFoundCustomer(data);
      setView('confirm');
    },
    onError: () => {
      setQrError('Código QR no encontrado. ¿Deseas registrarte?');
      setView('scanning'); // stay in scanning view to show error + retry
    },
  });

  // ---------------------------------------------------------------------------
  // Quick register
  // ---------------------------------------------------------------------------
  const quickRegister = useMutation({
    mutationFn: () =>
      api
        .post(`/kiosk/customers/quick-register`, { name: regName, email: regEmail || undefined, phone: regPhone || undefined })
        .then((r) => r.data as {
          message: string;
          emailSent: boolean;
          code: string;
          qrDataUrl: string;
          customer: KioskCustomer;
        }),
    onSuccess: (data) => {
      setRegMessage(
        data.emailSent
          ? `¡Listo, ${regName}! Te enviamos tu código QR al correo ${regEmail}. Podrás usarlo en tu próxima visita.`
          : `¡Listo, ${regName}! Tu cuenta fue creada. Solicita tu código QR en oficina.`,
      );
      setRegisteredCustomer(data.customer);
      setRegisteredCode(data.code);
      setRegisteredQr(data.qrDataUrl);
      setRegDone(true);
    },
  });

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim()) return;
    quickRegister.mutate();
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  const confirmCustomer = () => {
    if (!foundCustomer) return;
    const customer: KioskCustomer = {
      id: foundCustomer.id,
      code: foundCustomer.code,
      name: foundCustomer.name,
      loyaltyPoints: foundCustomer.loyaltyPoints,
      isExempt: foundCustomer.isExempt,
    };
    setCustomer(customer); // navigates to ORDER_TYPE
  };

  const continueAsGuest = () => {
    setCustomer(null); // navigates to ORDER_TYPE
  };

  const useRegisteredCustomer = () => {
    if (!registeredCustomer) return;
    setCustomer(registeredCustomer);
  };

  // ---------------------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------------------

  // 1. QR scanning view
  if (view === 'scanning') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 gap-6 px-8">
        <h2 className="text-3xl font-bold text-white">Escanea tu código QR</h2>

        <div className="relative w-72 h-72 rounded-2xl overflow-hidden border-4 border-brand-500 bg-black">
          <video ref={videoRef} className="w-full h-full object-cover" playsInline />
          {qrStatus === 'scanning' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 border-2 border-brand-400 rounded-lg opacity-60" />
            </div>
          )}
          {(qrStatus === 'starting' || qrStatus === 'idle') && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        <canvas ref={canvasRef} className="hidden" />

        {qrStatus === 'error' && (
          <p className="text-red-400 text-center text-lg max-w-xs">{qrError || 'Error al acceder a la cámara.'}</p>
        )}
        {lookupCustomer.isPending && (
          <p className="text-gray-300 text-lg animate-pulse">Buscando cliente…</p>
        )}
        {qrError && !lookupCustomer.isPending && qrStatus !== 'error' && (
          <div className="flex flex-col items-center gap-3">
            <p className="text-red-400 text-center text-lg max-w-xs">{qrError}</p>
            <button
              onClick={() => { setQrError(''); startCamera(); }}
              className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-semibold"
            >
              Intentar de nuevo
            </button>
            <button
              onClick={() => { setView('register'); setQrError(''); }}
              className="text-brand-400 underline text-lg"
            >
              Registrarme ahora
            </button>
          </div>
        )}

        <button
          onClick={() => { stopCamera(); setView('main'); setQrError(''); setQrStatus('idle'); }}
          className="text-gray-400 hover:text-white text-lg underline"
        >
          ← Volver
        </button>
      </div>
    );
  }

  // 2. Customer confirmation view
  if (view === 'confirm' && foundCustomer) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 gap-8 px-8">
        <div className="flex flex-col items-center gap-4 bg-gray-800 border-2 border-brand-500 rounded-3xl p-10 w-full max-w-sm">
          <span className="text-6xl">👤</span>
          <h2 className="text-3xl font-bold text-white text-center">{foundCustomer.name}</h2>
          <div className="flex items-center gap-2 bg-brand-900 px-5 py-2 rounded-full">
            <span className="text-2xl">⭐</span>
            <span className="text-xl font-semibold text-brand-300">{foundCustomer.loyaltyPoints} puntos</span>
          </div>
        </div>
        <p className="text-gray-300 text-xl text-center">¿Eres tú? Confirma para continuar.</p>
        <div className="flex gap-6">
          <button
            onClick={confirmCustomer}
            className="px-10 py-5 bg-brand-600 hover:bg-brand-700 active:scale-95 text-white text-2xl font-bold rounded-3xl transition-all"
          >
            ¡Sí, soy yo!
          </button>
          <button
            onClick={() => { setFoundCustomer(null); setView('main'); }}
            className="px-10 py-5 bg-gray-700 hover:bg-gray-600 active:scale-95 text-white text-2xl font-bold rounded-3xl transition-all"
          >
            No soy yo
          </button>
        </div>
      </div>
    );
  }

  // 3. Quick register modal/view
  if (view === 'register') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 px-8">
        <div className="bg-gray-800 border border-gray-700 rounded-3xl p-10 w-full max-w-md flex flex-col gap-6">
          <h2 className="text-3xl font-bold text-white text-center">Crear cuenta rápida</h2>
          <p className="text-gray-300 text-center text-lg">Regístrate y acumula puntos en cada pedido.</p>

          {regDone ? (
            <div className="flex flex-col items-center gap-6">
              <span className="text-6xl">🎉</span>
              <p className="text-green-400 text-xl text-center font-semibold">{regMessage}</p>
              {registeredQr && (
                <div className="flex flex-col items-center gap-3 bg-white rounded-2xl p-4">
                  <img src={registeredQr} alt="QR del cliente" className="w-48 h-48 object-contain" />
                  <p className="text-gray-900 font-bold text-lg">Código: {registeredCode}</p>
                </div>
              )}
              <button
                onClick={useRegisteredCustomer}
                className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white text-xl font-bold rounded-2xl"
              >
                Usar esta cuenta ahora
              </button>
              <button
                onClick={continueAsGuest}
                className="w-full py-4 bg-gray-700 hover:bg-gray-600 text-white text-xl font-bold rounded-2xl"
              >
                Continuar como invitado
              </button>
            </div>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <label className="text-gray-300 font-semibold">Nombre *</label>
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  required
                  placeholder="Tu nombre"
                  className="bg-gray-700 border border-gray-600 text-white rounded-xl px-4 py-3 text-lg focus:outline-none focus:border-brand-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-gray-300 font-semibold">Email (para recibir tu QR)</label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="bg-gray-700 border border-gray-600 text-white rounded-xl px-4 py-3 text-lg focus:outline-none focus:border-brand-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-gray-300 font-semibold">Celular</label>
                <input
                  type="tel"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="8888-8888"
                  className="bg-gray-700 border border-gray-600 text-white rounded-xl px-4 py-3 text-lg focus:outline-none focus:border-brand-500"
                />
              </div>
              {quickRegister.isError && (
                <p className="text-red-400 text-center">
                  {(quickRegister.error as any)?.response?.data?.message ?? 'Error al registrar. Intenta de nuevo.'}
                </p>
              )}
              <button
                type="submit"
                disabled={quickRegister.isPending || !regName.trim()}
                className="w-full py-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xl font-bold rounded-2xl transition-all"
              >
                {quickRegister.isPending ? 'Guardando…' : regEmail ? 'Guardar y enviar QR' : 'Crear cuenta'}
              </button>
            </form>
          )}

          {!regDone && (
            <button
              onClick={() => setView('main')}
              className="text-gray-400 hover:text-white text-center underline"
            >
              ← Volver
            </button>
          )}
        </div>
      </div>
    );
  }

  // 4. Main screen (default)
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 gap-10 px-8">
      <div className="flex flex-col items-center gap-2 mb-4">
        <h1 className="text-5xl font-bold text-white text-center">¡Bienvenido!</h1>
        <p className="text-gray-400 text-2xl text-center">¿Cómo deseas continuar?</p>
      </div>

      <div className="flex gap-10 flex-wrap justify-center">
        {/* Sumar puntos */}
        <button
          onClick={startCamera}
          className="flex flex-col items-center gap-4 bg-gray-800 hover:bg-brand-700 active:scale-95 border-2 border-gray-700 hover:border-brand-500 rounded-3xl p-12 transition-all w-64"
        >
          <span className="text-6xl">📱</span>
          <span className="text-2xl font-bold text-white">Sumar puntos</span>
          <span className="text-gray-400 text-center text-sm">Escanea tu código QR</span>
        </button>

        {/* Invitado */}
        <button
          onClick={continueAsGuest}
          className="flex flex-col items-center gap-4 bg-gray-800 hover:bg-gray-700 active:scale-95 border-2 border-gray-700 hover:border-gray-500 rounded-3xl p-12 transition-all w-64"
        >
          <span className="text-6xl">🛒</span>
          <span className="text-2xl font-bold text-white">Invitado</span>
          <span className="text-gray-400 text-center text-sm">Ordenar sin cuenta</span>
        </button>
      </div>

      {/* Registro rápido */}
      <button
        onClick={() => setView('register')}
        className="text-brand-400 hover:text-brand-300 text-xl underline underline-offset-4 transition-colors mt-4"
      >
        ¿No tienes cuenta? Regístrate y empieza a ganar puntos →
      </button>
    </div>
  );
}
