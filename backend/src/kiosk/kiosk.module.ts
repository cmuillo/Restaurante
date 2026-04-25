import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KioskController } from './kiosk.controller';
import { KioskService } from './kiosk.service';
import { Category } from '../menu/entities/category.entity';
import { Product } from '../menu/entities/product.entity';
import { ProductModifier } from '../menu/entities/product-modifier.entity';
import { ModifierOption } from '../menu/entities/modifier-option.entity';
import { BranchConfig } from '../branches/entities/branch-config.entity';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Category, Product, ProductModifier, ModifierOption, BranchConfig]),
    OrdersModule,
  ],
  controllers: [KioskController],
  providers: [KioskService],
})
export class KioskModule {}
