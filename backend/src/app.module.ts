import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BranchesModule } from './branches/branches.module';
import { MenuModule } from './menu/menu.module';
import { OrdersModule } from './orders/orders.module';
import { KitchenModule } from './kitchen/kitchen.module';
import { PosModule } from './pos/pos.module';
import { BillingModule } from './billing/billing.module';
import { TablesModule } from './tables/tables.module';
import { InventoryModule } from './inventory/inventory.module';
import { ExpensesModule } from './expenses/expenses.module';
import { ReportsModule } from './reports/reports.module';
import { CustomersModule } from './customers/customers.module';
import { KioskModule } from './kiosk/kiosk.module';
import { AuditModule } from './audit/audit.module';
import { WebsocketsModule } from './websockets/websockets.module';
import { SettingsModule } from './settings/settings.module';

import { CreditNotesModule } from './credit-notes/credit-notes.module';
import { DebitNotesModule } from './debit-notes/debit-notes.module';
import { QuotationsModule } from './quotations/quotations.module';

@Module({
  imports: [
    // Config global
    ConfigModule.forRoot({ isGlobal: true }),

    // Base de datos PostgreSQL
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.getOrThrow<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: configService.get('DB_SYNC') === 'true',
        logging: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),

    // Rate limiting — protección contra abuso
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 20 },
      { name: 'medium', ttl: 10000, limit: 100 },
      { name: 'long', ttl: 60000, limit: 500 },
    ]),

    // Módulos de la aplicación
    AuthModule,
    UsersModule,
    BranchesModule,
    MenuModule,
    OrdersModule,
    KitchenModule,
    PosModule,
    BillingModule,
    TablesModule,
    InventoryModule,
    ExpensesModule,
    ReportsModule,
    CustomersModule,
    KioskModule,
    AuditModule,
    WebsocketsModule,
    SettingsModule,
    CreditNotesModule,
    DebitNotesModule,
    QuotationsModule,
  ],
})
export class AppModule {}
