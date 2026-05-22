import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BranchScopeGuard } from '../auth/guards/branch-scope.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { WaiterService } from './waiter.service';
import { CreateOrderDto } from '../orders/dto/create-order.dto';
import { AddOrderItemsDto } from './dto/add-order-items.dto';

@ApiTags('Waiter')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, BranchScopeGuard)
@Roles(UserRole.WAITER, UserRole.CASHIER, UserRole.BRANCH_ADMIN, UserRole.SUPER_ADMIN)
@Controller('waiter')
export class WaiterController {
  constructor(private readonly waiterService: WaiterService) {}

  @Get(':branchId/menu')
  @ApiOperation({ summary: 'Menú completo para el mesero (todos los productos activos)' })
  getMenu(@Param('branchId', ParseUUIDPipe) branchId: string) {
    return this.waiterService.getMenu(branchId);
  }

  @Get(':branchId/tables')
  @ApiOperation({ summary: 'Mesas activas de la sucursal' })
  getTables(@Param('branchId', ParseUUIDPipe) branchId: string) {
    return this.waiterService.getTables(branchId);
  }

  @Get('tables/:tableId/active-order')
  @ApiOperation({ summary: 'Orden activa de la mesa' })
  getActiveOrder(
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Query('branchId', ParseUUIDPipe) branchId: string,
  ) {
    return this.waiterService.getActiveOrder(tableId, branchId);
  }

  @Post('orders')
  @ApiOperation({ summary: 'Crear nueva orden' })
  createOrder(@Body() dto: CreateOrderDto, @CurrentUser() user: any) {
    return this.waiterService.createOrder(dto, user.id);
  }

  @Post('orders/:orderId/items')
  @ApiOperation({ summary: 'Agregar ítems a orden existente' })
  addItems(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: AddOrderItemsDto,
    @CurrentUser() user: any,
  ) {
    return this.waiterService.addItemsToOrder(orderId, branchId, dto, user.id);
  }

  @Patch('tables/:tableId/request-bill')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Solicitar cuenta — cambia estado de mesa a bill_requested' })
  requestBill(
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @CurrentUser() user: any,
  ) {
    return this.waiterService.requestBill(tableId, branchId, user.id);
  }

  @Patch('tables/:tableId/release')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liberar mesa manualmente (PAID → FREE)' })
  releaseTable(
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @CurrentUser() user: any,
  ) {
    return this.waiterService.releaseTable(tableId, branchId, user.id);
  }

  @Get(':branchId/kitchen-stats')
  @ApiOperation({ summary: 'Estadísticas en tiempo real de cocina (para meseros)' })
  getKitchenStats(@Param('branchId', ParseUUIDPipe) branchId: string) {
    return this.waiterService.getKitchenStats(branchId);
  }
}
