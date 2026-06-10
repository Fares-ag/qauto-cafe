import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { WS_CLIENT_EVENTS, WS_EVENTS } from '@qauto/shared-types';
import { DomainEventsService } from '../events/domain-events.service';
import { OrderQueueService } from '../orders/order-queue.service';
import { JwtPayload } from '../auth/types/authenticated-user.type';

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    organizationId: string;
    branchId?: string;
  };
}

@WebSocketGateway({
  namespace: '/ws',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly domainEvents: DomainEventsService,
    private readonly orderQueue: OrderQueueService,
  ) {}

  afterInit() {
    this.domainEvents.registerGateway(this);
    this.logger.log('WebSocket gateway ready at /ws');
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ??
        (client.handshake.query?.token as string | undefined);

      if (!token) {
        throw new UnauthorizedException('Missing token');
      }

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      client.data = {
        userId: payload.sub,
        organizationId: payload.organizationId,
        branchId: payload.branchId,
      };
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(_client: AuthenticatedSocket) {
    // no-op
  }

  @SubscribeMessage(WS_CLIENT_EVENTS.SUBSCRIBE)
  async handleSubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { branchId: string },
  ) {
    const branchId = body?.branchId ?? client.data.branchId;
    if (!branchId) return { ok: false };

    client.join(this.branchRoom(branchId));
    client.data.branchId = branchId;

    const snapshot = await this.orderQueue.getQueueSnapshot(branchId, client.data.organizationId);
    client.emit(WS_EVENTS.ORDER_QUEUE_SNAPSHOT, snapshot);
    return { ok: true, branchId };
  }

  @SubscribeMessage(WS_CLIENT_EVENTS.RESYNC)
  async handleResync(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { branchId?: string },
  ) {
    const branchId = body?.branchId ?? client.data.branchId;
    if (!branchId) return { ok: false };

    const snapshot = await this.orderQueue.getQueueSnapshot(branchId, client.data.organizationId);
    client.emit(WS_EVENTS.ORDER_QUEUE_SNAPSHOT, snapshot);
    return { ok: true };
  }

  @SubscribeMessage(WS_CLIENT_EVENTS.PING)
  handlePing() {
    return { event: 'pong', data: { at: new Date().toISOString() } };
  }

  emitToBranch(branchId: string, event: string, payload: unknown) {
    this.server.to(this.branchRoom(branchId)).emit(event, payload);
  }

  private branchRoom(branchId: string) {
    return `branch:${branchId}`;
  }
}
