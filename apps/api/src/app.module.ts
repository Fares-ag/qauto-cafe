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
import { EventsModule } from './events/events.module';
import { WsModule } from './ws/ws.module';
import { ShiftsModule } from './shifts/shifts.module';
import { ReportsModule } from './reports/reports.module';
import { JobsModule } from './jobs/jobs.module';

import { AuditModule } from './audit/audit.module';
import { ProcurementModule } from './procurement/procurement.module';
import { CustomersModule } from './customers/customers.module';
import { IngredientsAdminModule } from './ingredients-admin/ingredients-admin.module';
import { DiscountsModule } from './discounts/discounts.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { GiftCardsModule } from './gift-cards/gift-cards.module';
import { CommonModule } from './common/common.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env', '../../.env'],
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }]),
    CommonModule,
    PrismaModule,
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
    CustomersModule,
    IngredientsAdminModule,
    DiscountsModule,
    LoyaltyModule,
    GiftCardsModule,
    WsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
