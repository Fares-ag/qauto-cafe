import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/procurement.dto';
import { decimalToString } from '../common/utils/decimal.util';

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(organizationId: string, includeInactive = false) {
    const suppliers = await this.prisma.supplier.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { name: 'asc' },
      include: { _count: { select: { items: true, purchaseOrders: true } } },
    });

    return suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      contactName: s.contactName,
      email: s.email,
      phone: s.phone,
      isActive: s.isActive,
      itemCount: s._count.items,
      purchaseOrderCount: s._count.purchaseOrders,
    }));
  }

  async findOne(organizationId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return {
      id: supplier.id,
      name: supplier.name,
      code: supplier.code,
      contactName: supplier.contactName,
      email: supplier.email,
      phone: supplier.phone,
      isActive: supplier.isActive,
    };
  }

  async update(organizationId: string, userId: string, id: string, dto: UpdateSupplierDto) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');

    const updated = await this.prisma.supplier.update({
      where: { id },
      data: {
        name: dto.name,
        contactName: dto.contactName,
        email: dto.email,
        phone: dto.phone,
        isActive: dto.isActive,
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'UPDATE',
      entityType: 'supplier',
      entityId: id,
      afterState: { name: updated.name, isActive: updated.isActive },
    });

    return this.findOne(organizationId, id);
  }

  async softDelete(organizationId: string, userId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');

    await this.prisma.supplier.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'DELETE',
      entityType: 'supplier',
      entityId: id,
    });

    return { id, deleted: true };
  }

  async create(organizationId: string, userId: string, dto: CreateSupplierDto) {
    const supplier = await this.prisma.supplier.create({
      data: {
        organizationId,
        name: dto.name,
        code: dto.code,
        contactName: dto.contactName,
        email: dto.email,
        phone: dto.phone,
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'CREATE',
      entityType: 'supplier',
      entityId: supplier.id,
      afterState: { name: dto.name, code: dto.code },
    });

    return { id: supplier.id, name: supplier.name, code: supplier.code };
  }
}
