import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TablesService } from './tables.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BranchScopeGuard } from '../auth/guards/branch-scope.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { TableStatus } from './entities/table.entity';
import { CreateTableDto, UpdateTableDto } from './dto/table.dto';

@ApiTags('Tables')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, BranchScopeGuard)
@Controller('tables')
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.CASHIER, UserRole.WAITER)
  @ApiOperation({ summary: 'Listar mesas de la sucursal' })
  findAll(@Query('branchId', ParseUUIDPipe) branchId: string) {
    return this.tablesService.findAll(branchId);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Crear mesa' })
  create(@Query('branchId', ParseUUIDPipe) branchId: string, @Body() dto: CreateTableDto) {
    return this.tablesService.create(branchId, dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Actualizar mesa' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: UpdateTableDto,
  ) {
    return this.tablesService.update(id, branchId, dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.CASHIER, UserRole.WAITER)
  @ApiOperation({ summary: 'Cambiar estado de la mesa' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: { status: TableStatus; waiterId?: string },
  ) {
    return this.tablesService.updateStatus(id, branchId, dto.status, dto.waiterId);
  }
}
