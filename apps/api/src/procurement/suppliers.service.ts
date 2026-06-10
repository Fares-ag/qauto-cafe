import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateSupplierDto } from './dto/procurement.dto';
import { decimalToString } from '../common/utils/decimal.util';

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(organizationId: string) {
    const suppliers = await this.prisma.supplier.findMany({
      where: { organizationId, deletedAt: null, isActive: true },
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
      itemCount: s._count.items,
      purchaseOrderCount: s._count.purchaseOrders,
    }));
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
