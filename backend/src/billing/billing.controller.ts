import { Controller, Get, Post, Body, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { CreateInvoiceDto } from './dto/billing.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BranchScopeGuard } from '../auth/guards/branch-scope.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('Billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, BranchScopeGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('invoices')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.CASHIER)
  @ApiOperation({ summary: 'Crear factura / cobrar orden' })
  createInvoice(@Body() dto: CreateInvoiceDto, @CurrentUser() user: any) {
    return this.billingService.createInvoice(dto, user.id);
  }

  @Get('invoices')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.CASHIER, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Listar facturas de la sucursal' })
  findAll(
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.billingService.findAll(
      branchId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Post('invoices/:id/cancel')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Anular factura' })
  cancelInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { reason: string },
    @CurrentUser() user: any,
  ) {
    return this.billingService.cancelInvoice(id, dto.reason, user.id);
  }
}
