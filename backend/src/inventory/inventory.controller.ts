import { Controller, Get, Post, Body, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BranchScopeGuard } from '../auth/guards/branch-scope.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { TransactionType } from './entities/inventory-transaction.entity';
import { CreateInventoryItemDto, AdjustStockDto } from './dto/inventory.dto';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, BranchScopeGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('items')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.ACCOUNTANT, UserRole.CHEF)
  @ApiOperation({ summary: 'Listar ítems de inventario' })
  findAll(@Query('branchId', ParseUUIDPipe) branchId: string) {
    return this.inventoryService.findAll(branchId);
  }

  @Get('items/low-stock')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Ítems con stock bajo' })
  getLowStock(@Query('branchId', ParseUUIDPipe) branchId: string) {
    return this.inventoryService.getLowStockItems(branchId);
  }

  @Post('items')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Crear ítem de inventario' })
  create(@Query('branchId', ParseUUIDPipe) branchId: string, @Body() dto: CreateInventoryItemDto) {
    return this.inventoryService.create(branchId, dto);
  }

  @Post('items/:id/adjust')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Ajustar stock de un ítem' })
  adjustStock(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: AdjustStockDto,
    @CurrentUser() user: any,
  ) {
    return this.inventoryService.adjustStock(id, branchId, dto.quantity, dto.type as unknown as TransactionType, dto.notes, user.id);
  }

  @Get('items/:id/transactions')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Historial de movimientos de un ítem' })
  getTransactions(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.getTransactions(id);
  }
}
