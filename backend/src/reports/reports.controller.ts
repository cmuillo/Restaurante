import { Controller, Get, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BranchScopeGuard } from '../auth/guards/branch-scope.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, BranchScopeGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('daily-sales')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Reporte de ventas diarias' })
  dailySales(
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @Query('date') date: string,
  ) {
    return this.reportsService.dailySales(branchId, new Date(date));
  }

  @Get('sales-by-range')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Ventas por rango de fechas' })
  salesByRange(
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.reportsService.salesByRange(branchId, new Date(from), new Date(to));
  }

  @Get('top-products')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Productos más vendidos' })
  topProducts(
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.reportsService.topProducts(branchId, new Date(from), new Date(to));
  }

  @Get('top-customers')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Clientes con más compras' })
  topCustomers(
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = Number(limit);
    const safeLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10;
    return this.reportsService.topCustomers(branchId, new Date(from), new Date(to), safeLimit);
  }

  @Get('peak-hours')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Horas pico de ventas' })
  peakHours(
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.reportsService.peakHours(branchId, new Date(from), new Date(to));
  }

  @Get('profit-loss')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Pérdidas y ganancias' })
  profitLoss(
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.reportsService.profitLoss(branchId, new Date(from), new Date(to));
  }

  @Get('sales-by-category')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Ventas por categoría de producto' })
  salesByCategory(
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.reportsService.salesByCategory(branchId, new Date(from), new Date(to));
  }
}
