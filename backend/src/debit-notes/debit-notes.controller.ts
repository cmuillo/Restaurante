import {
  Controller, Post, Get, Patch, Body, Param, UseGuards, Query, ParseUUIDPipe,
} from '@nestjs/common';
import { DebitNotesService } from './debit-notes.service';
import { CreateDebitNoteDto, CancelDebitNoteDto } from './dto/create-debit-note.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BranchScopeGuard } from '../auth/guards/branch-scope.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user.entity';

@Controller('debit-notes')
@UseGuards(JwtAuthGuard, RolesGuard, BranchScopeGuard)
export class DebitNotesController {
  constructor(private readonly debitNotesService: DebitNotesService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.ACCOUNTANT)
  async create(
    @Body() dto: CreateDebitNoteDto,
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @CurrentUser() user: User,
  ) {
    return this.debitNotesService.create(branchId, dto, user.id);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.ACCOUNTANT)
  async findAll(@Query('branchId', ParseUUIDPipe) branchId: string) {
    return this.debitNotesService.findAll(branchId);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.ACCOUNTANT)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('branchId', ParseUUIDPipe) branchId: string,
  ) {
    return this.debitNotesService.findOne(id, branchId);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN)
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelDebitNoteDto,
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @CurrentUser() user: User,
  ) {
    return this.debitNotesService.cancel(id, branchId, dto, user.id);
  }
}
