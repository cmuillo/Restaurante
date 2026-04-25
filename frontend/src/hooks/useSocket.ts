import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

type EventHandler = (data: unknown) => void;

interface UseSocketOptions {
  branchId: string;
  events: Record<string, EventHandler>;
  enabled?: boolean;
}

/**
 * Hook para conectar al WebSocket del backend y suscribirse a eventos de sucursal.
 * Se desconecta automáticamente al desmontar el componente.
 */
export function useSocket({ branchId, events, enabled = true }: UseSocketOptions) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!enabled || !branchId) return;

    const token = localStorage.getItem('access_token');
    const socket = io('/ws', {
      auth: { token },
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('branch:join', { branchId });
    });

    Object.entries(events).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, enabled]);

  return socketRef;
}
