import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { TerminalsModule } from './terminals/terminals.module';
import { UsersModule } from './users/users.module';
import { BranchesModule } from './branches/branches.module';
import { MenuModule } from './menu/menu.module';
import { OrdersModule } from './orders/orders.module';
import { PublicModule } from './public/public.module';
import { RecipeModule } from './recipe/recipe.module';
import { InventoryModule } from './inventory/inventory.module';
import { RedisModule } from './redis/redis.module';
import { EventsModule } from './events/events.module';
import { WsModule } from './ws/ws.module';
import { ShiftsModule } from './shifts/shifts.module';
import { ReportsModule } from './reports/reports.module';
import { JobsModule } from './jobs/jobs.module';

import { AuditModule } from './audit/audit.module';
import { ProcurementModule } from './procurement/procurement.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    RedisModule,
    EventsModule,
    AuditModule,
    AuthModule,
    HealthModule,
    TerminalsModule,
    UsersModule,
    BranchesModule,
    MenuModule,
    OrdersModule,
    PublicModule,
    RecipeModule,
    InventoryModule,
    ShiftsModule,
    ReportsModule,
    JobsModule,
    ProcurementModule,
    WsModule,
  ],
})
export class AppModule {}
