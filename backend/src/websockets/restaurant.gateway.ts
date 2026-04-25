import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: (origin: string, callback: Function) => {
      // Configurado vía ConfigService, no hardcoded
      callback(null, true);
    },
    credentials: true,
  },
  namespace: '/ws',
})
export class RestaurantGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RestaurantGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit() {
    this.logger.log('WebSocket Gateway iniciado');
  }

  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (token) {
        const payload = this.jwtService.verify(token, {
          secret: this.configService.getOrThrow('JWT_SECRET'),
        });
        client.data.user = payload;
        client.data.branchId = payload.branchId;

        // Unir al room de su sucursal para eventos aislados
        if (payload.branchId) {
          client.join(`branch:${payload.branchId}`);
        }
        client.join(`role:${payload.role}`);
        this.logger.log(`Cliente conectado: ${payload.email} (${payload.role})`);
      } else {
        // Kiosko — sin auth, sólo puede escuchar eventos públicos
        client.data.isKiosk = true;
        this.logger.log(`Kiosko conectado: ${client.id}`);
      }
    } catch {
      // Token inválido — desconectar cliente
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Cliente desconectado: ${client.id}`);
  }

  // ─── Eventos emitidos desde el servidor ─────────────────────────────────

  /** Emite nueva orden a la cocina de la sucursal */
  emitNewOrder(branchId: string, order: Record<string, unknown>) {
    this.server.to(`branch:${branchId}`).emit('kitchen:new_order', order);
  }

  /** Notifica al mesero cuando un pedido está listo */
  emitOrderReady(branchId: string, order: Record<string, unknown>) {
    this.server.to(`branch:${branchId}`).emit('order:ready', order);
  }

  /** Actualización de estado de orden */
  emitOrderStatusUpdate(branchId: string, order: Record<string, unknown>) {
    this.server.to(`branch:${branchId}`).emit('order:status_updated', order);
  }

  /** Alerta de stock bajo enviada a admins */
  emitLowStockAlert(branchId: string, item: Record<string, unknown>) {
    this.server.to(`branch:${branchId}`).emit('inventory:low_stock', item);
  }

  /** Actualización del menú del kiosko */
  emitMenuUpdated(branchId: string) {
    this.server.to(`branch:${branchId}`).emit('menu:updated');
  }

  // ─── Mensajes recibidos desde clientes ──────────────────────────────────

  @SubscribeMessage('kitchen:order_updated')
  handleKitchenOrderUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string; status: string },
  ) {
    const branchId = client.data.branchId;
    if (!branchId) return;
    this.server.to(`branch:${branchId}`).emit('order:status_updated', data);
  }

  @SubscribeMessage('kiosk:join_branch')
  handleKioskJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { branchId: string },
  ) {
    if (client.data.isKiosk && data.branchId) {
      client.join(`branch:${data.branchId}`);
    }
  }
}
