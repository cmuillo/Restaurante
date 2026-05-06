import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.CASHIER)
  @ApiOperation({ summary: 'Buscar / listar clientes' })
  findAll(
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    const status = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.customersService.findAll(search, status);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.CASHIER)
  @ApiOperation({ summary: 'Obtener cliente' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.findOne(id);
  }

  @Get('code/:code')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.CASHIER)
  @ApiOperation({ summary: 'Buscar cliente por código' })
  findByCode(@Param('code') code: string) {
    return this.customersService.findByCode(code);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.CASHIER)
  @ApiOperation({ summary: 'Crear cliente' })
  create(@Body() dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.CASHIER)
  @ApiOperation({ summary: 'Actualizar cliente' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(id, dto);
  }

  @Post(':id/send-qr')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.CASHIER)
  @ApiOperation({ summary: 'Enviar QR del cliente por email' })
  sendQr(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.sendQrByEmail(id);
  }

  @Get(':id/loyalty')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.CASHIER)
  @ApiOperation({ summary: 'Historial de puntos de fidelización' })
  getLoyaltyHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.getLoyaltyHistory(id);
  }
}
