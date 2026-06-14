import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateBranchDto, UpdateBranchDto, UpsertBranchSettingsDto } from './dto/branch.dto';

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(organizationId: string) {
    return this.prisma.branch.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
        phone: true,
        isActive: true,
        businessDayCutoverHour: true,
      },
    });
  }

  async findOne(organizationId: string, id: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
        phone: true,
        isActive: true,
        businessDayCutoverHour: true,
      },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async create(organizationId: string, userId: string, dto: CreateBranchDto) {
    const existing = await this.prisma.branch.findFirst({
      where: { organizationId, code: dto.code, deletedAt: null },
    });
    if (existing) throw new ConflictException('Branch code already exists');

    const branch = await this.prisma.branch.create({
      data: {
        organizationId,
        name: dto.name,
        code: dto.code,
        address: dto.address,
        phone: dto.phone,
        businessDayCutoverHour: dto.businessDayCutoverHour ?? 4,
      },
    });

    await this.audit.log({
      organizationId,
      branchId: branch.id,
      userId,
      action: 'CREATE',
      entityType: 'branch',
      entityId: branch.id,
      afterState: { name: dto.name, code: dto.code },
    });

    return this.findOne(organizationId, branch.id);
  }

  async update(organizationId: string, userId: string, id: string, dto: UpdateBranchDto) {
    await this.findOne(organizationId, id);
    const updated = await this.prisma.branch.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.businessDayCutoverHour !== undefined
          ? { businessDayCutoverHour: dto.businessDayCutoverHour }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    await this.audit.log({
      organizationId,
      branchId: id,
      userId,
      action: 'UPDATE',
      entityType: 'branch',
      entityId: id,
      afterState: { name: updated.name },
    });

    return this.findOne(organizationId, id);
  }

  async remove(organizationId: string, userId: string, id: string) {
    await this.findOne(organizationId, id);
    await this.prisma.branch.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await this.audit.log({
      organizationId,
      branchId: id,
      userId,
      action: 'SOFT_DELETE',
      entityType: 'branch',
      entityId: id,
    });

    return { id, deleted: true };
  }

  async getSettings(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    const settings = await this.prisma.branchSetting.findMany({
      where: { branchId: id },
      orderBy: { key: 'asc' },
    });

    return {
      branchId: id,
      settings: Object.fromEntries(settings.map((s) => [s.key, s.value])),
    };
  }

  async upsertSettings(
    organizationId: string,
    userId: string,
    id: string,
    dto: UpsertBranchSettingsDto,
  ) {
    await this.findOne(organizationId, id);

    await this.prisma.$transaction(
      Object.entries(dto.settings).map(([key, value]) =>
        this.prisma.branchSetting.upsert({
          where: { branchId_key: { branchId: id, key } },
          update: { value: value as Prisma.InputJsonValue },
          create: { branchId: id, key, value: value as Prisma.InputJsonValue },
        }),
      ),
    );

    await this.audit.log({
      organizationId,
      branchId: id,
      userId,
      action: 'UPDATE',
      entityType: 'branch_settings',
      entityId: id,
      afterState: dto.settings as Prisma.InputJsonValue,
    });

    return this.getSettings(organizationId, id);
  }
}
