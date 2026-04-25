import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { Product } from './entities/product.entity';
import { RestaurantGateway } from '../websockets/restaurant.gateway';
import { AuditService } from '../audit/audit.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(Category) private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Product) private readonly productRepository: Repository<Product>,
    private readonly gateway: RestaurantGateway,
    private readonly auditService: AuditService,
  ) {}

  // ─── Categorías ──────────────────────────────────────────────────────────

  async getCategories(branchId: string) {
    return this.categoryRepository.find({
      where: { branchId, isActive: true },
      order: { sortOrder: 'ASC' },
    });
  }

  async createCategory(branchId: string, dto: CreateCategoryDto): Promise<Category> {
    const category = this.categoryRepository.create({ ...dto, branchId });
    return this.categoryRepository.save(category);
  }

  async updateCategory(id: string, branchId: string, dto: UpdateCategoryDto, userId?: string): Promise<Category> {
    const cat = await this.categoryRepository.findOne({ where: { id, branchId } });
    if (!cat) throw new NotFoundException('Categoría no encontrada');
    await this.categoryRepository.update(id, dto);
    const updated = await this.categoryRepository.findOneOrFail({ where: { id } });
    this.gateway.emitMenuUpdated(branchId);
    return updated;
  }

  async deleteCategory(id: string, branchId: string): Promise<void> {
    const cat = await this.categoryRepository.findOne({ where: { id, branchId }, relations: ['products'] });
    if (!cat) throw new NotFoundException('Categoría no encontrada');
    if (cat.products?.length) throw new BadRequestException('No se puede eliminar una categoría con productos activos');
    await this.categoryRepository.remove(cat);
    this.gateway.emitMenuUpdated(branchId);
  }

  // ─── Productos ──────────────────────────────────────────────────────────

  async getProducts(branchId: string, categoryId?: string) {
    const query = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.modifiers', 'modifier')
      .leftJoinAndSelect('modifier.options', 'option')
      .leftJoin('product.category', 'cat')
      .where('cat.branchId = :branchId', { branchId })
      .andWhere('product.isActive = true')
      .orderBy('product.sortOrder', 'ASC');

    if (categoryId) {
      query.andWhere('product.categoryId = :categoryId', { categoryId });
    }

    return query.getMany();
  }

  async createProduct(dto: CreateProductDto, userId?: string): Promise<Product> {
    const product = this.productRepository.create(dto);
    const saved = await this.productRepository.save(product);
    const category = await this.categoryRepository.findOne({ where: { id: dto.categoryId } });
    if (category) this.gateway.emitMenuUpdated(category.branchId);
    return saved;
  }

  async updateProduct(id: string, branchId: string, dto: UpdateProductDto, userId?: string): Promise<Product> {
    const product = await this.productRepository
      .createQueryBuilder('product')
      .leftJoin('product.category', 'cat')
      .where('product.id = :id AND cat.branchId = :branchId', { id, branchId })
      .getOne();

    if (!product) throw new NotFoundException('Producto no encontrado');

    const oldPrice = product.price;
    await this.productRepository.update(id, dto);

    if (dto.price && dto.price !== oldPrice) {
      await this.auditService.log({
        branchId,
        userId,
        action: 'product.price_change',
        entity: 'Product',
        entityId: id,
        oldValue: { price: oldPrice },
        newValue: { price: dto.price },
      });
    }

    this.gateway.emitMenuUpdated(branchId);
    return this.productRepository.findOneOrFail({ where: { id }, relations: ['modifiers', 'modifiers.options'] });
  }

  async toggleProduct(id: string, branchId: string, isActive: boolean, userId?: string) {
    const product = await this.productRepository
      .createQueryBuilder('product')
      .leftJoin('product.category', 'cat')
      .where('product.id = :id AND cat.branchId = :branchId', { id, branchId })
      .getOne();

    if (!product) throw new NotFoundException('Producto no encontrado');
    await this.productRepository.update(id, { isActive });
    this.gateway.emitMenuUpdated(branchId);
  }

  async deleteProduct(id: string, branchId: string): Promise<void> {
    const product = await this.productRepository
      .createQueryBuilder('product')
      .leftJoin('product.category', 'cat')
      .where('product.id = :id AND cat.branchId = :branchId', { id, branchId })
      .getOne();

    if (!product) throw new NotFoundException('Producto no encontrado');
    await this.productRepository.remove(product);
    this.gateway.emitMenuUpdated(branchId);
  }
}
