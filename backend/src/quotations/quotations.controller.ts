import {
  Controller, Get, Post, Patch, Param, Body, Query,
  ParseUUIDPipe, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QuotationsService } from './quotations.service';
import { CreateQuotationDto, UpdateQuotationDto } from './dto/quotation.dto';

@UseGuards(JwtAuthGuard)
@Controller('quotations')
export class QuotationsController {
  constructor(private readonly quotationsService: QuotationsService) {}

  @Get()
  findAll(@Query('branchId', ParseUUIDPipe) branchId: string) {
    return this.quotationsService.findAll(branchId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.quotationsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateQuotationDto) {
    return this.quotationsService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuotationDto,
  ) {
    return this.quotationsService.update(id, dto);
  }

  @Post(':id/send-email')
  sendEmail(@Param('id', ParseUUIDPipe) id: string) {
    return this.quotationsService.sendEmail(id);
  }

  @Post(':id/create-order')
  createOrder(@Param('id', ParseUUIDPipe) id: string) {
    return this.quotationsService.createOrder(id);
  }
}
