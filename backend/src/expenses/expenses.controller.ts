import { Controller, Get, Post, Body, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ExpensesService } from './expenses.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BranchScopeGuard } from '../auth/guards/branch-scope.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CreateExpenseDto } from './dto/expense.dto';

@ApiTags('Expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, BranchScopeGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

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
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.expensesService.findAll(
      branchId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Get('summary')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Resumen de gastos por categoría' })
  getSummary(
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.expensesService.getSummaryByCategory(branchId, new Date(from), new Date(to));
  }
}
