import { Controller, Get, Post, Body, Param, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { KioskService } from './kiosk.service';
import { CreateKioskOrderDto } from './dto/create-kiosk-order.dto';
import { KioskQuickRegisterDto } from './dto/kiosk-customer.dto';

/**
 * Endpoints públicos del kiosko — SIN autenticación.
 * Sólo expone datos de menú y creación de órdenes.
 * No hay acceso a datos de administración.
 */
@ApiTags('Kiosk (público)')
@Controller('kiosk')
export class KioskController {
  constructor(private readonly kioskService: KioskService) {}

  @Get(':branchId/menu')
  @ApiOperation({ summary: 'Obtener menú del kiosko (público, sin auth)' })
  getMenu(@Param('branchId', ParseUUIDPipe) branchId: string) {
    return this.kioskService.getMenu(branchId);
  }

  @Post(':branchId/orders')
  @Throttle({ medium: { limit: 30, ttl: 60000 } }) // protección contra spam de órdenes
  @ApiOperation({ summary: 'Crear orden desde kiosko (público, sin auth)' })
  createOrder(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: CreateKioskOrderDto,
  ) {
    return this.kioskService.createOrder(branchId, dto);
  }

  @Get('customers/code/:code')
  @ApiOperation({ summary: 'Buscar cliente por código QR (público, sin auth)' })
  findCustomerByCode(@Param('code') code: string) {
    return this.kioskService.findCustomerByCode(code);
  }

  @Post('customers/quick-register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ medium: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Registro rápido de cliente desde kiosko (público, sin auth)' })
  quickRegister(@Body() dto: KioskQuickRegisterDto) {
    return this.kioskService.quickRegister(dto);
  }
}
