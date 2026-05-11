import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from './entities/invoice.entity';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { Order } from '../orders/entities/order.entity';
import { BranchConfig } from '../branches/entities/branch-config.entity';
import { Product } from '../menu/entities/product.entity';
import { AuditModule } from '../audit/audit.module';
import { HaciendaModule } from '../hacienda/hacienda.module';
import { CustomersModule } from '../customers/customers.module';
import { WebsocketsModule } from '../websockets/websockets.module';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, Order, BranchConfig, Product]), AuditModule, HaciendaModule, CustomersModule, WebsocketsModule],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
