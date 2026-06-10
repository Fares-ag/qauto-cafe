import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  async getBootstrap() {
    const org = await this.prisma.organization.findFirst({
      where: { slug: 'qauto', deletedAt: null },
      include: {
        branches: {
          where: { isActive: true, deletedAt: null },
          orderBy: { name: 'asc' },
          take: 1,
        },
      },
    });

    const branch = org?.branches[0];
    if (!org || !branch) {
      return { organization: null, branch: null };
    }

    return {
      organization: { id: org.id, name: org.name, slug: org.slug },
      branch: { id: branch.id, name: branch.name, code: branch.code },
    };
  }
}
