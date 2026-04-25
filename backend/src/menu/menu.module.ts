import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './entities/category.entity';
import { Product } from './entities/product.entity';
import { ProductModifier } from './entities/product-modifier.entity';
import { ModifierOption } from './entities/modifier-option.entity';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';
import { WebsocketsModule } from '../websockets/websockets.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Category, Product, ProductModifier, ModifierOption]),
    WebsocketsModule,
    AuditModule,
  ],
  controllers: [MenuController],
  providers: [MenuService],
  exports: [MenuService],
})
export class MenuModule {}
