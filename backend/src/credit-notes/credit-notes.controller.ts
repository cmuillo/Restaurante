import {
  Controller, Post, Get, Patch, Body, Param, UseGuards, Query, ParseUUIDPipe,
} from '@nestjs/common';
import { CreditNotesService } from './credit-notes.service';
import { CreateCreditNoteDto, CancelCreditNoteDto } from './dto/create-credit-note.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BranchScopeGuard } from '../auth/guards/branch-scope.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user.entity';

@Controller('credit-notes')
@UseGuards(JwtAuthGuard, RolesGuard, BranchScopeGuard)
export class CreditNotesController {
  constructor(private readonly creditNotesService: CreditNotesService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.ACCOUNTANT)
  async create(
    @Body() dto: CreateCreditNoteDto,
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @CurrentUser() user: User,
  ) {
    return this.creditNotesService.create(branchId, dto, user.id);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.ACCOUNTANT)
  async findAll(@Query('branchId', ParseUUIDPipe) branchId: string) {
    return this.creditNotesService.findAll(branchId);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.ACCOUNTANT)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('branchId', ParseUUIDPipe) branchId: string,
  ) {
    return this.creditNotesService.findOne(id, branchId);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN)
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelCreditNoteDto,
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @CurrentUser() user: User,
  ) {
    return this.creditNotesService.cancel(id, branchId, dto, user.id);
  }
}
