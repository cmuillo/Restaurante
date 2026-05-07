import {
  Controller, Get, Query, UseGuards, ParseUUIDPipe, Patch, Param,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { KitchenService } from './kitchen.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BranchScopeGuard } from '../auth/guards/branch-scope.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('Kitchen')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, BranchScopeGuard)
@Controller('kitchen')
export class KitchenController {
  constructor(private readonly kitchenService: KitchenService) {}

  @Get('orders')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.CHEF, UserRole.CASHIER)
  @ApiOperation({ summary: 'Órdenes pendientes para cocina (KDS)' })
  getPendingOrders(@Query('branchId', ParseUUIDPipe) branchId: string) {
    return this.kitchenService.getPendingOrders(branchId);
  }

  @Patch('orders/:id/start-preparation')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.CHEF, UserRole.CASHIER)
  @ApiOperation({ summary: 'Marcar orden en preparación desde cocina' })
  startPreparation(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @CurrentUser() user: any,
  ) {
    return this.kitchenService.startPreparation(id, branchId, user?.id);
  }

  @Patch('orders/:id/ready')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.CHEF, UserRole.CASHIER)
  @ApiOperation({ summary: 'Marcar orden lista desde cocina' })
  markReady(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @CurrentUser() user: any,
  ) {
    return this.kitchenService.markReady(id, branchId, user?.id);
  }

  @Patch('orders/:id/printed')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.CHEF, UserRole.CASHIER)
  @ApiOperation({ summary: 'Registrar impresión de ticket de cocina' })
  markPrinted(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @CurrentUser() user: any,
  ) {
    return this.kitchenService.markPrinted(id, branchId, user?.id);
  }

  @Get('avg-prep-time')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.CHEF)
  @ApiOperation({ summary: 'Tiempo promedio de preparación (últimos 7 días)' })
  getAvgPrepTime(@Query('branchId', ParseUUIDPipe) branchId: string) {
    return this.kitchenService.getAvgPrepTime(branchId);
  }
}
