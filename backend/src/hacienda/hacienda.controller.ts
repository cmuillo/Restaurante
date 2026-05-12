import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BranchScopeGuard } from '../auth/guards/branch-scope.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { HaciendaService } from './hacienda.service';
import { UpdateHaciendaConfigDto } from './dto/hacienda-config.dto';
import * as path from 'path';
import * as fs from 'fs';
import type { Request } from 'express';
import type multer from 'multer';

// Carpeta donde se almacenan los certificados .p12
const CERTS_DIR = path.resolve(process.cwd(), 'certs');
if (!fs.existsSync(CERTS_DIR)) {
  fs.mkdirSync(CERTS_DIR, { recursive: true });
}

@UseGuards(JwtAuthGuard, RolesGuard, BranchScopeGuard)
@Controller('hacienda')
export class HaciendaController {
  constructor(private readonly haciendaService: HaciendaService) {}

  /**
   * GET /hacienda/config?branchId=<uuid>
   * Devuelve la configuración Hacienda de una sucursal (contraseña oculta).
   */
  @Get('config')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.ACCOUNTANT)
  getConfig(@Query('branchId', ParseUUIDPipe) branchId: string) {
    return this.haciendaService.getConfig(branchId);
  }

  /**
   * GET /hacienda/exchange-rates
   * Devuelve los tipos de cambio actuales (USD y EUR).
   */
  @Get('exchange-rates')
  getExchangeRates() {
    return this.haciendaService.getExchangeRates();
  }

  /**
   * PUT /hacienda/config?branchId=<uuid>
   * Actualiza los campos de configuración Hacienda en BranchConfig.
   */
  @Put('config')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN)
  updateConfig(
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: UpdateHaciendaConfigDto,
  ) {
    return this.haciendaService.updateConfig(branchId, dto);
  }

  /**
   * POST /hacienda/certificate?branchId=<uuid>
   * Sube el archivo .p12 (multipart/form-data, campo "file").
   * Guarda el archivo en disco y actualiza haciendaP12Path en BranchConfig.
   */
  @Post('certificate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: CERTS_DIR,
        filename: (_req: Request, file: Express.Multer.File, cb: (err: Error | null, name: string) => void) => {
          const ext = path.extname(file.originalname).toLowerCase();
          const uniqueName = `cert_${Date.now()}${ext}`;
          cb(null, uniqueName);
        },
      }),
      fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
        const allowed = ['.p12', '.pfx'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
          cb(null, true);
        } else {
          cb(null, false);
        }
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB máximo
    }),
  )
  uploadCertificate(
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Debe adjuntar un archivo .p12 o .pfx válido');
    }

    return this.haciendaService.saveCertificatePath(branchId, file.path);
  }

  /**
   * GET /hacienda/status?branchId=<uuid>&limit=50
   * Retorna las últimas facturas con sus estados de Hacienda.
   */
  @Get('status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.ACCOUNTANT)
  getStatus(
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @Query('limit') limit = 50,
  ) {
    return this.haciendaService.getRecentStatuses(branchId, Number(limit));
  }

  /**
   * POST /hacienda/invoices/:id/resend?branchId=<uuid>
   * Reenvía manualmente un comprobante (solo facturas en error/rejected).
   */
  @Post('invoices/:id/resend')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN)
  resend(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('branchId', ParseUUIDPipe) branchId: string,
  ) {
    return this.haciendaService.resend(id, branchId);
  }

  /**
   * GET /hacienda/cabys-codes?search=...
   * Devuelve los códigos CABYS dinámicamente.
   */
  @Get('cabys-codes')
  getCabysCodes(@Query('search') search: string) {
    return this.haciendaService.getCabysCodes(search);
  }
}
