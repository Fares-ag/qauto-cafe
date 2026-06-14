import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import {
  AssignRoleDto,
  ResetPinDto,
  SetUserBranchesDto,
  UpdateUserDto,
} from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(organizationId: string) {
    return this.prisma.user.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { firstName: 'asc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        employeeNumber: true,
        phone: true,
        status: true,
        lastLoginAt: true,
        role: { select: { id: true, slug: true, name: true } },
        branches: {
          include: { branch: { select: { id: true, name: true, code: true } } },
        },
      },
    });
  }

  async findOne(organizationId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        employeeNumber: true,
        phone: true,
        status: true,
        lastLoginAt: true,
        role: { select: { id: true, slug: true, name: true } },
        branches: {
          include: { branch: { select: { id: true, name: true, code: true } } },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(organizationId: string, dto: CreateUserDto) {
    const role = await this.prisma.role.findFirst({
      where: { organizationId, slug: 'staff' },
    });

    if (!role) {
      throw new NotFoundException('Staff role not found. Run database seed.');
    }

    if (dto.email) {
      const existing = await this.prisma.user.findFirst({
        where: { organizationId, email: dto.email.toLowerCase(), deletedAt: null },
      });
      if (existing) {
        throw new ConflictException('Email already in use');
      }
    }

    const pinHash = await bcrypt.hash(dto.pin, 10);
    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 10) : null;

    const user = await this.prisma.user.create({
      data: {
        organizationId,
        roleId: role.id,
        email: dto.email?.toLowerCase(),
        passwordHash,
        pinHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        employeeNumber: dto.employeeNumber,
        branches: {
          create: dto.branchIds.map((branchId, index) => ({
            branchId,
            isDefault: index === 0,
          })),
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        employeeNumber: true,
        role: { select: { slug: true } },
      },
    });

    return user;
  }

  async update(organizationId: string, userId: string, id: string, dto: UpdateUserDto) {
    const existing = await this.findOne(organizationId, id);

    if (dto.email) {
      const conflict = await this.prisma.user.findFirst({
        where: {
          organizationId,
          email: dto.email.toLowerCase(),
          deletedAt: null,
          NOT: { id },
        },
      });
      if (conflict) throw new ConflictException('Email already in use');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
        ...(dto.email !== undefined ? { email: dto.email.toLowerCase() } : {}),
        ...(dto.employeeNumber !== undefined ? { employeeNumber: dto.employeeNumber } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        employeeNumber: true,
        phone: true,
        status: true,
        role: { select: { id: true, slug: true, name: true } },
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'UPDATE',
      entityType: 'user',
      entityId: id,
      beforeState: { email: existing.email, status: existing.status },
      afterState: { email: updated.email, status: updated.status },
    });

    return updated;
  }

  async assignRole(organizationId: string, userId: string, id: string, dto: AssignRoleDto) {
    await this.findOne(organizationId, id);
    const role = await this.prisma.role.findFirst({
      where: { id: dto.roleId, organizationId, deletedAt: null },
    });
    if (!role) throw new NotFoundException('Role not found');

    const updated = await this.prisma.user.update({
      where: { id },
      data: { roleId: dto.roleId },
      select: {
        id: true,
        role: { select: { id: true, slug: true, name: true } },
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'UPDATE',
      entityType: 'user_role',
      entityId: id,
      afterState: { roleId: dto.roleId, roleSlug: role.slug },
    });

    return updated;
  }

  async setBranches(organizationId: string, userId: string, id: string, dto: SetUserBranchesDto) {
    await this.findOne(organizationId, id);

    const branches = await this.prisma.branch.findMany({
      where: { organizationId, id: { in: dto.branchIds }, deletedAt: null },
    });
    if (branches.length !== dto.branchIds.length) {
      throw new NotFoundException('One or more branches not found');
    }

    const defaultBranchId = dto.defaultBranchId ?? dto.branchIds[0];

    await this.prisma.$transaction(async (tx) => {
      await tx.userBranch.deleteMany({ where: { userId: id } });
      await tx.userBranch.createMany({
        data: dto.branchIds.map((branchId) => ({
          userId: id,
          branchId,
          isDefault: branchId === defaultBranchId,
        })),
      });
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'UPDATE',
      entityType: 'user_branches',
      entityId: id,
      afterState: { branchIds: dto.branchIds },
    });

    return this.findOne(organizationId, id);
  }

  async resetPin(organizationId: string, actorId: string, id: string, dto: ResetPinDto) {
    await this.findOne(organizationId, id);
    const pinHash = await bcrypt.hash(dto.pin, 10);

    await this.prisma.user.update({
      where: { id },
      data: { pinHash },
    });

    await this.audit.log({
      organizationId,
      userId: actorId,
      action: 'UPDATE',
      entityType: 'user_pin',
      entityId: id,
      metadata: { reset: true },
    });

    return { id, pinReset: true };
  }
}
