import { useRef, useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import jsQR from 'jsqr';
import waiterApi from '../lib/waiter-api';
import { useWaiterStore } from '../store/waiter.store';

export default function CustomerScreen() {
  const { selectedTable, setCustomer, goTo } = useWaiterStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const scanningRef = useRef(false);
  const [cameraError, setCameraError] = useState('');

  const stopCamera = () => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    scanningRef.current = false;
  };

  const lookupMutation = useMutation({
    mutationFn: (code: string) =>
      waiterApi.get(`/kiosk/customers/code/${code}`).then((r) => r.data),
    onSuccess: (customer) => {
      if (!mountedRef.current) return;
      stopCamera();
      setCustomer(customer);
      goTo('MENU');
    },
    onError: () => {
      // código no encontrado — continuar escaneando
    },
  });

  useEffect(() => {
    mountedRef.current = true;

    // Verificar soporte de cámara (no disponible en HTTP sin localhost en algunos navegadores)
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Cámara no disponible. Puedes continuar como invitado.');
      return;
    }

    const scan = () => {
      if (!mountedRef.current || !scanningRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(scan);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        rafRef.current = requestAnimationFrame(scan);
        return;
      }
      ctx.drawImage(video, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code?.data && !lookupMutation.isPending) {
        lookupMutation.mutate(code.data);
      }
      if (mountedRef.current && scanningRef.current) {
        rafRef.current = requestAnimationFrame(scan);
      }
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (!mountedRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        scanningRef.current = true;
        if (videoRef.current) videoRef.current.srcObject = stream;
        rafRef.current = requestAnimationFrame(scan);
      })
      .catch(() => {
        if (mountedRef.current) setCameraError('No se pudo acceder a la cámara.');
      });

    return () => {
      mountedRef.current = false;
      stopCamera();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGuest = () => {
    stopCamera();
    setCustomer(null);
    goTo('MENU');
  };

  const contextLabel = selectedTable?.id ? `Mesa ${selectedTable.number}` : 'Para llevar';

  return (
    <div className="flex-1 flex flex-col bg-gray-900">
      {/* Banner de contexto */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800">
        <button
          onClick={() => { stopCamera(); goTo('TABLES'); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-700 hover:bg-gray-600 active:scale-95 text-gray-100 text-sm font-semibold transition-all"
        >
          ‹ Volver
        </button>
        <span className="text-white font-semibold text-sm">{contextLabel}</span>
        <div className="w-16" />
      </div>

      {/* Área cámara */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Marco escaneo */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-56 h-56 border-4 border-white/70 rounded-2xl" />
        </div>

        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 gap-4 px-8">
            <span className="text-4xl">📷</span>
            <p className="text-white text-center">{cameraError}</p>
          </div>
        )}

        {lookupMutation.isPending && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <p className="text-white font-bold">Buscando cliente…</p>
          </div>
        )}
      </div>

      {/* Instrucción */}
      <div className="bg-gray-800 px-4 pt-4 pb-2 text-center">
        <p className="text-gray-300 text-sm">
          Escanea el código QR del cliente o continúa como invitado
        </p>
      </div>

      {/* Acciones */}
      <div className="bg-gray-800 px-4 pb-6 flex flex-col gap-3">
        <button
          onClick={handleGuest}
          className="w-full bg-brand-600 hover:bg-brand-500 active:scale-95 text-white font-bold rounded-2xl py-4 text-base transition-all"
        >
          Continuar como invitado
        </button>
      </div>
    </div>
  );
}
