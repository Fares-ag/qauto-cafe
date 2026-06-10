import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
        status: true,
        lastLoginAt: true,
        role: { select: { slug: true, name: true } },
        branches: {
          include: { branch: { select: { id: true, name: true, code: true } } },
        },
      },
    });
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
}
