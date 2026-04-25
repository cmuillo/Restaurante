import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BranchScopeGuard } from '../auth/guards/branch-scope.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { OrderStatus, OrderType } from './entities/order.entity';
import { IsString, MaxLength } from 'class-validator';

class CancelOrderDto {
  @IsString()
  @MaxLength(300)
  reason: string;
}

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, BranchScopeGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Roles(
    UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN,
    UserRole.CASHIER, UserRole.WAITER,
  )
  @ApiOperation({ summary: 'Crear nueva orden' })
  create(@Body() dto: CreateOrderDto, @CurrentUser() user: any) {
    return this.ordersService.create(dto, user.id);
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN,
    UserRole.CASHIER, UserRole.WAITER, UserRole.CHEF,
  )
  @ApiOperation({ summary: 'Listar órdenes de la sucursal' })
  findAll(
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @Query('status') status?: OrderStatus,
    @Query('type') type?: OrderType,
  ) {
    return this.ordersService.findAll(branchId, { status, type });
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN,
    UserRole.CASHIER, UserRole.WAITER, UserRole.CHEF,
  )
  @ApiOperation({ summary: 'Obtener orden por ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('branchId', ParseUUIDPipe) branchId: string,
  ) {
    return this.ordersService.findOne(id, branchId);
  }

  @Patch(':id/status')
  @Roles(
    UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN,
    UserRole.CASHIER, UserRole.WAITER, UserRole.CHEF,
  )
  @ApiOperation({ summary: 'Actualizar estado de la orden' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.ordersService.updateStatus(id, branchId, dto, user.id);
  }

  @Post(':id/cancel')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.CASHIER)
  @ApiOperation({ summary: 'Cancelar orden' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: CancelOrderDto,
    @CurrentUser() user: any,
  ) {
    return this.ordersService.cancel(id, branchId, dto.reason, user.id);
  }
}
