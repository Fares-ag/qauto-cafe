import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogInput {
  organizationId: string;
  branchId?: string;
  userId?: string;
  terminalId?: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  beforeState?: Prisma.InputJsonValue;
  afterState?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput) {
    return this.prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        branchId: input.branchId,
        userId: input.userId,
        terminalId: input.terminalId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        beforeState: input.beforeState,
        afterState: input.afterState,
        metadata: input.metadata,
      },
    });
  }

  async list(
    organizationId: string,
    query: {
      branchId?: string;
      action?: AuditAction;
      entityType?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const limit = Math.min(query.limit ?? 50, 100);
    const offset = query.offset ?? 0;

    const where = {
      organizationId,
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: items.map((row) => ({
        id: row.id,
        branchId: row.branchId,
        userId: row.userId,
        userName: row.user ? `${row.user.firstName} ${row.user.lastName}` : null,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        beforeState: row.beforeState,
        afterState: row.afterState,
        metadata: row.metadata,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
      limit,
      offset,
    };
  }
}
