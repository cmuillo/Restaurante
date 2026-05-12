import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { Invoice } from '../billing/entities/invoice.entity';
import { Order } from '../orders/entities/order.entity';
import { BranchConfig } from '../branches/entities/branch-config.entity';
import { HaciendaAuthService } from './hacienda-auth.service';
import { XmlBuilderService } from './xml-builder.service';
import { XadesSignerService } from './xades-signer.service';
import { HaciendaService } from './hacienda.service';
import { HaciendaExchangeRateService } from './hacienda-exchange-rate.service';
import { HaciendaController } from './hacienda.controller';

@Module({
  imports: [
    ConfigModule,
    MulterModule.register({}),
    TypeOrmModule.forFeature([Invoice, Order, BranchConfig]),
  ],
  controllers: [HaciendaController],
  providers: [
    HaciendaAuthService,
    XmlBuilderService,
    XadesSignerService,
    HaciendaExchangeRateService,
    HaciendaService,
  ],
  exports: [HaciendaService, HaciendaExchangeRateService],
})
export class HaciendaModule {}
