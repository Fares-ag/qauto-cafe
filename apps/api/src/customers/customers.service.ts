import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function formatName(firstName: string | null, lastName: string | null): string {
  return [firstName, lastName].filter(Boolean).join(' ').trim();
}

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(organizationId: string) {
    const customers = await this.prisma.customer.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    return customers.map((c) => this.serialize(c));
  }

  async search(organizationId: string, query: string, limit = 10) {
    const q = query.trim();
    if (!q) return [];

    const customers = await this.prisma.customer.findMany({
      where: {
        organizationId,
        deletedAt: null,
        isActive: true,
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
          { employeeId: { contains: q, mode: 'insensitive' } },
          { department: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      include: { loyaltyAccount: { select: { pointsBalance: true } } },
    });

    return customers.map((c) => ({
      ...this.serialize(c),
      pointsBalance: c.loyaltyAccount?.pointsBalance ?? 0,
    }));
  }

  async findOne(organizationId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return this.serialize(customer);
  }

  async create(organizationId: string, userId: string, dto: CreateCustomerDto) {
    const { firstName, lastName } = splitName(dto.name);
    const customer = await this.prisma.customer.create({
      data: {
        organizationId,
        firstName,
        lastName,
        department: dto.department,
        employeeId: dto.employeeId,
        email: dto.email?.toLowerCase(),
        phone: dto.phone,
        notes: dto.notes,
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'CREATE',
      entityType: 'customer',
      entityId: customer.id,
      afterState: { name: dto.name, department: dto.department },
    });

    return this.serialize(customer);
  }

  async update(organizationId: string, userId: string, id: string, dto: UpdateCustomerDto) {
    const existing = await this.prisma.customer.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Customer not found');

    const nameParts = dto.name ? splitName(dto.name) : null;
    const updated = await this.prisma.customer.update({
      where: { id },
      data: {
        ...(nameParts ? { firstName: nameParts.firstName, lastName: nameParts.lastName } : {}),
        ...(dto.department !== undefined ? { department: dto.department } : {}),
        ...(dto.employeeId !== undefined ? { employeeId: dto.employeeId } : {}),
        ...(dto.email !== undefined ? { email: dto.email?.toLowerCase() ?? null } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'UPDATE',
      entityType: 'customer',
      entityId: id,
      beforeState: this.serialize(existing),
      afterState: this.serialize(updated),
    });

    return this.serialize(updated);
  }

  async remove(organizationId: string, userId: string, id: string) {
    const existing = await this.prisma.customer.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Customer not found');

    await this.prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'SOFT_DELETE',
      entityType: 'customer',
      entityId: id,
    });

    return { id, deleted: true };
  }

  private serialize(customer: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    employeeId: string | null;
    department: string | null;
    notes: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: customer.id,
      name: formatName(customer.firstName, customer.lastName),
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone,
      employeeId: customer.employeeId,
      department: customer.department,
      notes: customer.notes,
      isActive: customer.isActive,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
    };
  }
}
