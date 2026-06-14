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
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { WS_CLIENT_EVENTS, WS_EVENTS } from '@qauto/shared-types';
import { DomainEventsService } from '../events/domain-events.service';
import { OrderQueueService } from '../orders/order-queue.service';
import { JwtPayload } from '../auth/types/authenticated-user.type';
import { BranchAccessService } from '../common/services/branch-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { getWsCorsOrigins } from '../config/security';

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    organizationId: string;
    branchId?: string;
    permissions: string[];
  };
}

@WebSocketGateway({ namespace: '/ws' })
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly domainEvents: DomainEventsService,
    private readonly orderQueue: OrderQueueService,
    private readonly branchAccess: BranchAccessService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(server: Server) {
    const corsOrigin = getWsCorsOrigins(this.config);
    if (server.engine?.opts) {
      server.engine.opts.cors = { origin: corsOrigin, credentials: true };
    }
    this.domainEvents.registerGateway(this);
    this.logger.log('WebSocket gateway ready at /ws');
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ??
        (client.handshake.query?.token as string | undefined) ??
        (client.handshake.headers.cookie
          ?.split(';')
          .map((c) => c.trim())
          .find((c) => c.startsWith('qauto_access='))
          ?.split('=')[1]);

      if (!token) {
        throw new UnauthorizedException('Missing token');
      }

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      const user = await this.prisma.user.findFirst({
        where: { id: payload.sub, status: 'ACTIVE', deletedAt: null },
        include: {
          role: {
            include: {
              permissions: { include: { permission: { select: { code: true } } } },
            },
          },
        },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid user');
      }

      client.data = {
        userId: payload.sub,
        organizationId: payload.organizationId,
        branchId: payload.branchId,
        permissions: user.role.permissions.map((p) => p.permission.code),
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

    await this.assertBranchAccess(client, branchId);

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

    await this.assertBranchAccess(client, branchId);

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

  private async assertBranchAccess(client: AuthenticatedSocket, branchId: string) {
    await this.branchAccess.assertUserBranchAccess(
      {
        id: client.data.userId,
        organizationId: client.data.organizationId,
        roleId: '',
        role: '',
        permissions: client.data.permissions,
        firstName: '',
        lastName: '',
      },
      branchId,
    );
  }

  private branchRoom(branchId: string) {
    return `branch:${branchId}`;
  }
}
