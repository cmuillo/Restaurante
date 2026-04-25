import { Controller, Get, Post, Body, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PosService } from './pos.service';
import { OpenShiftDto, CloseShiftDto } from './dto/shift.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BranchScopeGuard } from '../auth/guards/branch-scope.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('POS')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, BranchScopeGuard)
@Controller('pos')
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Post('shift/open')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.CASHIER)
  @ApiOperation({ summary: 'Abrir turno / caja' })
  openShift(
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @CurrentUser() user: any,
    @Body() dto: OpenShiftDto,
  ) {
    return this.posService.openShift(branchId, user.id, dto);
  }

  @Post('shift/close')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.CASHIER)
  @ApiOperation({ summary: 'Cerrar turno / arqueo de caja' })
  closeShift(
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @CurrentUser() user: any,
    @Body() dto: CloseShiftDto,
  ) {
    return this.posService.closeShift(branchId, user.id, dto);
  }

  @Get('shift/current')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.CASHIER, UserRole.WAITER)
  @ApiOperation({ summary: 'Turno activo de la sucursal' })
  getCurrentShift(@Query('branchId', ParseUUIDPipe) branchId: string) {
    return this.posService.getCurrentShift(branchId);
  }

  @Get('shift/history')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN)
  @ApiOperation({ summary: 'Historial de turnos' })
  getShiftHistory(
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @Query('limit') limit?: number,
  ) {
    return this.posService.getShiftHistory(branchId, limit);
  }
}
