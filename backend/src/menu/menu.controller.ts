import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MenuService } from './menu.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BranchScopeGuard } from '../auth/guards/branch-scope.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';

@ApiTags('Menu')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, BranchScopeGuard)
@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  // ─── Categorías ──────────────────────────────────────────────────────────

  @Get('categories')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.CASHIER, UserRole.WAITER, UserRole.CHEF)
  @ApiOperation({ summary: 'Listar categorías del menú' })
  getCategories(@Query('branchId', ParseUUIDPipe) branchId: string) {
    return this.menuService.getCategories(branchId);
  }

  @Post('categories')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Crear categoría' })
  createCategory(
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.menuService.createCategory(branchId, dto);
  }

  @Patch('categories/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Actualizar categoría' })
  updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() user: any,
  ) {
    return this.menuService.updateCategory(id, branchId, dto, user.id);
  }

  @Delete('categories/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Eliminar categoría' })
  deleteCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('branchId', ParseUUIDPipe) branchId: string,
  ) {
    return this.menuService.deleteCategory(id, branchId);
  }

  // ─── Productos ──────────────────────────────────────────────────────────

  @Get('products')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.CASHIER, UserRole.WAITER, UserRole.CHEF)
  @ApiOperation({ summary: 'Listar productos' })
  getProducts(
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.menuService.getProducts(branchId, categoryId);
  }

  @Post('products')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Crear producto' })
  createProduct(@Body() dto: CreateProductDto, @CurrentUser() user: any) {
    return this.menuService.createProduct(dto, user.id);
  }

  @Patch('products/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Actualizar producto' })
  updateProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: any,
  ) {
    return this.menuService.updateProduct(id, branchId, dto, user.id);
  }

  @Delete('products/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Eliminar producto' })
  deleteProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('branchId', ParseUUIDPipe) branchId: string,
  ) {
    return this.menuService.deleteProduct(id, branchId);
  }

  @Patch('products/:id/toggle')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Activar/desactivar producto' })
  toggleProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: { isActive: boolean },
    @CurrentUser() user: any,
  ) {
    return this.menuService.toggleProduct(id, branchId, dto.isActive, user.id);
  }
}
