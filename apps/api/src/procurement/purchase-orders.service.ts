import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PurchaseOrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryOpsService } from '../inventory/inventory-ops.service';
import { AuditService } from '../audit/audit.service';
import {
  CreatePurchaseOrderDto,
  ReceivePurchaseOrderDto,
} from './dto/procurement.dto';
import { decimalToString } from '../common/utils/decimal.util';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryOps: InventoryOpsService,
    private readonly audit: AuditService,
  ) {}

  async list(organizationId: string, branchId: string) {
    await this.assertBranch(organizationId, branchId);

    const orders = await this.prisma.purchaseOrder.findMany({
      where: { branchId },
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        lines: {
          include: {
            ingredient: { select: { id: true, name: true, code: true } },
            uom: { select: { code: true } },
          },
        },
      },
    });

    return orders.map((po) => this.serialize(po));
  }

  async create(organizationId: string, userId: string, dto: CreatePurchaseOrderDto) {
    await this.assertBranch(organizationId, dto.branchId);

    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, organizationId, deletedAt: null },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    if (!dto.lines.length) throw new BadRequestException('PO must have at least one line');

    const poNumber = await this.nextPoNumber(dto.branchId);

    const po = await this.prisma.$transaction(async (tx) => {
      const created = await tx.purchaseOrder.create({
        data: {
          branchId: dto.branchId,
          supplierId: dto.supplierId,
          poNumber,
          status: 'DRAFT',
          notes: dto.notes,
          createdById: userId,
        },
      });

      for (const line of dto.lines) {
        const ingredient = await tx.ingredient.findFirst({
          where: { id: line.ingredientId, organizationId },
        });
        if (!ingredient) throw new NotFoundException(`Ingredient not found: ${line.ingredientId}`);

        await tx.purchaseOrderLine.create({
          data: {
            purchaseOrderId: created.id,
            ingredientId: line.ingredientId,
            quantityOrdered: line.quantityOrdered,
            uomId: ingredient.baseUomId,
            unitCost: line.unitCost,
          },
        });
      }

      return created;
    });

    await this.audit.log({
      organizationId,
      branchId: dto.branchId,
      userId,
      action: 'CREATE',
      entityType: 'purchase_order',
      entityId: po.id,
      afterState: { poNumber, supplierId: dto.supplierId },
    });

    return this.findOne(organizationId, po.id);
  }

  async update(
    organizationId: string,
    userId: string,
    poId: string,
    dto: { notes?: string; lines?: Array<{ ingredientId: string; quantityOrdered: string; unitCost: string }> },
  ) {
    const po = await this.getPo(organizationId, poId);
    if (po.status !== 'DRAFT') throw new BadRequestException('Only draft POs can be edited');

    await this.prisma.$transaction(async (tx) => {
      if (dto.notes !== undefined) {
        await tx.purchaseOrder.update({ where: { id: poId }, data: { notes: dto.notes } });
      }

      if (dto.lines) {
        if (!dto.lines.length) throw new BadRequestException('PO must have at least one line');
        await tx.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: poId } });

        for (const line of dto.lines) {
          const ingredient = await tx.ingredient.findFirst({
            where: { id: line.ingredientId, organizationId },
          });
          if (!ingredient) throw new NotFoundException(`Ingredient not found: ${line.ingredientId}`);

          await tx.purchaseOrderLine.create({
            data: {
              purchaseOrderId: poId,
              ingredientId: line.ingredientId,
              quantityOrdered: line.quantityOrdered,
              uomId: ingredient.baseUomId,
              unitCost: line.unitCost,
            },
          });
        }
      }
    });

    await this.audit.log({
      organizationId,
      branchId: po.branchId,
      userId,
      action: 'UPDATE',
      entityType: 'purchase_order',
      entityId: poId,
    });

    return this.findOne(organizationId, poId);
  }

  async send(organizationId: string, userId: string, poId: string) {
    const po = await this.getPo(organizationId, poId);
    if (po.status !== 'DRAFT') throw new BadRequestException('Only draft POs can be sent');

    await this.prisma.purchaseOrder.update({
      where: { id: poId },
      data: { status: 'SENT', orderedAt: new Date() },
    });

    await this.audit.log({
      organizationId,
      branchId: po.branchId,
      userId,
      action: 'UPDATE',
      entityType: 'purchase_order',
      entityId: poId,
      afterState: { status: 'SENT' },
    });

    return this.findOne(organizationId, poId);
  }

  async cancel(organizationId: string, userId: string, poId: string) {
    const po = await this.getPo(organizationId, poId);
    if (po.status === 'RECEIVED' || po.status === 'PARTIAL') {
      throw new BadRequestException('Received POs cannot be cancelled');
    }
    if (po.status === 'CANCELLED') {
      throw new BadRequestException('PO is already cancelled');
    }

    await this.prisma.purchaseOrder.update({
      where: { id: poId },
      data: { status: 'CANCELLED' },
    });

    await this.audit.log({
      organizationId,
      branchId: po.branchId,
      userId,
      action: 'UPDATE',
      entityType: 'purchase_order',
      entityId: poId,
      afterState: { status: 'CANCELLED' },
    });

    return this.findOne(organizationId, poId);
  }

  async receive(
    organizationId: string,
    userId: string,
    poId: string,
    dto: ReceivePurchaseOrderDto,
  ) {
    const po = await this.getPo(organizationId, poId);
    if (po.status === 'CANCELLED' || po.status === 'RECEIVED') {
      throw new BadRequestException('PO cannot be received');
    }

    for (const receiveLine of dto.lines) {
      const line = po.lines.find((l) => l.id === receiveLine.lineId);
      if (!line) throw new NotFoundException(`PO line not found: ${receiveLine.lineId}`);

      const qty = new Prisma.Decimal(receiveLine.quantityReceived);
      const remaining = line.quantityOrdered.sub(line.quantityReceived);
      if (qty.lte(0) || qty.gt(remaining)) {
        throw new BadRequestException(`Invalid receive quantity for line ${line.id}`);
      }

      await this.inventoryOps.receive(organizationId, userId, {
        branchId: dto.branchId,
        ingredientId: line.ingredientId,
        quantity: receiveLine.quantityReceived,
        unitCost: decimalToString(line.unitCost),
        notes: `PO ${po.poNumber}`,
      });

      await this.prisma.purchaseOrderLine.update({
        where: { id: line.id },
        data: { quantityReceived: line.quantityReceived.add(qty) },
      });
    }

    const updated = await this.prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: { lines: true },
    });

    const allReceived = updated!.lines.every((l) =>
      l.quantityReceived.gte(l.quantityOrdered),
    );
    const anyReceived = updated!.lines.some((l) => l.quantityReceived.gt(0));

    let status: PurchaseOrderStatus = po.status;
    if (allReceived) status = 'RECEIVED';
    else if (anyReceived) status = 'PARTIAL';

    await this.prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        status,
        receivedAt: allReceived ? new Date() : po.receivedAt,
      },
    });

    await this.audit.log({
      organizationId,
      branchId: dto.branchId,
      userId,
      action: 'STOCK_RECEIVE',
      entityType: 'purchase_order',
      entityId: poId,
      afterState: { status },
    });

    return this.findOne(organizationId, poId);
  }

  async findOne(organizationId: string, poId: string) {
    const po = await this.getPo(organizationId, poId);
    return this.serialize(po);
  }

  private async getPo(organizationId: string, poId: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id: poId },
      include: {
        branch: true,
        supplier: { select: { id: true, name: true, code: true } },
        lines: {
          include: {
            ingredient: { select: { id: true, name: true, code: true } },
            uom: { select: { code: true } },
          },
        },
      },
    });

    if (!po || po.branch.organizationId !== organizationId) {
      throw new NotFoundException('Purchase order not found');
    }

    return po;
  }

  private serialize(po: {
    id: string;
    poNumber: string;
    status: PurchaseOrderStatus;
    notes: string | null;
    orderedAt: Date | null;
    receivedAt: Date | null;
    createdAt: Date;
    supplier: { id: string; name: string; code: string };
    lines: Array<{
      id: string;
      ingredientId: string;
      quantityOrdered: Prisma.Decimal;
      quantityReceived: Prisma.Decimal;
      unitCost: Prisma.Decimal;
      ingredient: { id: string; name: string; code: string };
      uom: { code: string };
    }>;
  }) {
    return {
      id: po.id,
      poNumber: po.poNumber,
      status: po.status,
      notes: po.notes,
      supplier: po.supplier,
      orderedAt: po.orderedAt?.toISOString() ?? null,
      receivedAt: po.receivedAt?.toISOString() ?? null,
      createdAt: po.createdAt.toISOString(),
      lines: po.lines.map((line) => ({
        id: line.id,
        ingredientId: line.ingredientId,
        ingredientName: line.ingredient.name,
        quantityOrdered: decimalToString(line.quantityOrdered),
        quantityReceived: decimalToString(line.quantityReceived),
        unitCost: decimalToString(line.unitCost),
        uom: line.uom.code,
      })),
    };
  }

  private async nextPoNumber(branchId: string) {
    const count = await this.prisma.purchaseOrder.count({ where: { branchId } });
    return `PO-${String(count + 1).padStart(5, '0')}`;
  }

  private async assertBranch(organizationId: string, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId, deletedAt: null },
    });
    if (!branch) throw new NotFoundException('Branch not found');
  }
}
