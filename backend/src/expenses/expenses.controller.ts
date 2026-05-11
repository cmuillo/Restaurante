import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ExpensesService } from './expenses.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BranchScopeGuard } from '../auth/guards/branch-scope.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/expense.dto';
import { ApproveExpenseInboxItemDto, ListExpenseInboxDto } from './dto/expense-inbox.dto';
import { ExpenseEmailConfigDto } from './dto/expense-email-config.dto';

@ApiTags('Expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, BranchScopeGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get('email-config')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Obtener configuración de correo para ingestión de facturas' })
  getEmailConfig(
    @Query('branchId') branchId?: string,
  ) {
    return this.expensesService.getEmailConfig(branchId);
  }

  @Post('email-config')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Guardar configuración de correo para ingestión de facturas' })
  setEmailConfig(
    @Body() dto: ExpenseEmailConfigDto,
  ) {
    return this.expensesService.setEmailConfig(dto);
  }

  private resolveBranchFilter(branchId: string | undefined, user: any): string | undefined {
    if (!branchId) {
      return user.role === UserRole.SUPER_ADMIN ? undefined : user.branchId;
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(branchId);
    if (!isUuid) {
      throw new BadRequestException('branchId inválido');
    }

    return branchId;
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Registrar gasto' })
  create(
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: CreateExpenseDto,
    @CurrentUser() user: any,
  ) {
    return this.expensesService.create(branchId, dto, user.id);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Listar gastos' })
  findAll(
    @Query('branchId') branchId: string | undefined,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @CurrentUser() user?: any,
  ) {
    const effectiveBranchId = this.resolveBranchFilter(branchId, user);
    return this.expensesService.findAll(
      effectiveBranchId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Get('summary')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Resumen de gastos por categoría' })
  getSummary(
    @Query('branchId') branchId: string | undefined,
    @Query('from') from: string,
    @Query('to') to: string,
    @CurrentUser() user?: any,
  ) {
    const effectiveBranchId = this.resolveBranchFilter(branchId, user);
    return this.expensesService.getSummaryByCategory(effectiveBranchId, new Date(from), new Date(to));
  }

  @Get('inbox')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Listar facturas detectadas en correos para aprobación' })
  listInbox(
    @Query('branchId') branchId: string | undefined,
    @Query() query: ListExpenseInboxDto,
    @CurrentUser() user?: any,
  ) {
    const effectiveBranchId = this.resolveBranchFilter(branchId, user);
    return this.expensesService.findInboxItems(effectiveBranchId, query.status);
  }

  @Post('inbox/:id/approve')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Aprobar factura de bandeja y convertirla en gasto' })
  approveInboxItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveExpenseInboxItemDto,
    @CurrentUser() user?: any,
  ) {
    const effectiveBranchId = this.resolveBranchFilter(dto.branchId, user);
    return this.expensesService.approveInboxItem(id, { ...dto, branchId: effectiveBranchId }, user);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Actualizar gasto' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expensesService.update(id, branchId, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.ACCOUNTANT)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar gasto' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('branchId', ParseUUIDPipe) branchId: string,
  ) {
    return this.expensesService.remove(id, branchId);
  }
}

