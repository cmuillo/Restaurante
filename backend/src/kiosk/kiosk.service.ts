import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../menu/entities/category.entity';
import { BranchConfig } from '../branches/entities/branch-config.entity';
import { OrdersService } from '../orders/orders.service';
import { CreateKioskOrderDto } from './dto/create-kiosk-order.dto';
import { OrderType } from '../orders/entities/order.entity';

@Injectable()
export class KioskService {
  constructor(
    @InjectRepository(Category) private readonly categoryRepository: Repository<Category>,
    @InjectRepository(BranchConfig) private readonly configRepository: Repository<BranchConfig>,
    private readonly ordersService: OrdersService,
  ) {}

  /**
   * Obtiene el menú público del kiosko (sin auth, sólo productos activos).
   * Incluye categorías, productos y modificadores para el flujo de autopedido.
   */
  async getMenu(branchId: string) {
    const config = await this.configRepository.findOne({ where: { branchId } });
    if (!config?.kioskEnabled) {
      throw new NotFoundException('El kiosko no está habilitado para esta sucursal');
    }

    const categories = await this.categoryRepository
      .createQueryBuilder('cat')
      .leftJoinAndSelect('cat.products', 'product', 'product.isActive = true AND product.showInKiosk = true')
      .leftJoinAndSelect('product.modifiers', 'modifier')
      .leftJoinAndSelect('modifier.options', 'option', 'option.isActive = true')
      .where('cat.branchId = :branchId', { branchId })
      .andWhere('cat.isActive = true')
      .andWhere('cat.showInKiosk = true')
      .orderBy('cat.sortOrder', 'ASC')
      .addOrderBy('product.sortOrder', 'ASC')
      .getMany();

    // Extraer productos como lista plana (con categoryId) para facilitar el render en el kiosco
    const products = categories.flatMap((cat) =>
      (cat.products ?? []).map((p) => ({ ...p, categoryId: cat.id })),
    );

    return {
      branchConfig: {
        currency: config.currency,
        taxPercentage: config.taxPercentage,
        tipPercentage: config.tipPercentage,
        inactivitySeconds: config.kioskInactivitySeconds,
      },
      categories: categories.map(({ products: _p, ...cat }) => cat), // categorías sin productos anidados
      products,
    };
  }

  /**
   * Crea una orden desde el kiosko (sin autenticación, sin userId).
   * El branchId viene del parámetro de la URL para evitar que el cliente lo manipule.
   */
  async createOrder(branchId: string, dto: CreateKioskOrderDto): Promise<{ orderNumber: number; total: number }> {
    const config = await this.configRepository.findOne({ where: { branchId } });
    if (!config?.kioskEnabled) {
      throw new NotFoundException('El kiosko no está habilitado para esta sucursal');
    }

    const order = await this.ordersService.create(
      {
        ...dto,
        branchId,
        type: dto.type ?? OrderType.KIOSK,
        taxPercentage: config.taxPercentage,
        tipPercentage: 0, // kiosko no aplica propina automática
      },
      undefined, // sin userId — orden de kiosko
    );

    return { orderNumber: order.orderNumber, total: order.total };
  }
}
