import { Injectable, NotFoundException } from '@nestjs/common';
import { ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../menu/entities/category.entity';
import { BranchConfig } from '../branches/entities/branch-config.entity';
import { Branch } from '../branches/entities/branch.entity';
import { OrdersService } from '../orders/orders.service';
import { EmailConfigService } from '../settings/services/email-config.service';
import { CreateKioskOrderDto } from './dto/create-kiosk-order.dto';
import { OrderType } from '../orders/entities/order.entity';
import { Customer } from '../customers/entities/customer.entity';
import { KioskQuickRegisterDto } from './dto/kiosk-customer.dto';
import { Table } from '../tables/entities/table.entity';
import { TableStatus } from '../tables/entities/table.entity';
import * as QRCode from 'qrcode';
import * as nodemailer from 'nodemailer';

@Injectable()
export class KioskService {
  constructor(
    @InjectRepository(Category) private readonly categoryRepository: Repository<Category>,
    @InjectRepository(BranchConfig) private readonly configRepository: Repository<BranchConfig>,
    @InjectRepository(Branch) private readonly branchRepository: Repository<Branch>,
    @InjectRepository(Customer) private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Table) private readonly tableRepository: Repository<Table>,
    private readonly ordersService: OrdersService,
    private readonly emailConfigService: EmailConfigService,
  ) {}

  /**
   * Obtiene el menú público del kiosko (sin auth, sólo productos activos).
   * Incluye categorías, productos y modificadores para el flujo de autopedido.
   */
  async getMenu(branchId: string) {
    const branch = await this.branchRepository.findOne({ where: { id: branchId, isActive: true } });
    if (!branch) {
      throw new NotFoundException('Sucursal no encontrada o inactiva');
    }

    const config = await this.configRepository.findOne({ where: { branchId } });
    if (!config?.kioskEnabled) {
      throw new NotFoundException('El kiosko no está habilitado para esta sucursal');
    }

    const categories = await this.categoryRepository
      .createQueryBuilder('cat')
      .leftJoinAndSelect('cat.products', 'product', 'product.isActive = true AND product.showInKiosk = true')
      .leftJoinAndSelect('product.modifiers', 'modifier')
      .leftJoinAndSelect('modifier.options', 'option', 'option.isActive = true')
      .where('cat.branchId = :branchId', { branchId })
      .andWhere('cat.isActive = true')
      .andWhere('cat.showInKiosk = true')
      .orderBy('cat.sortOrder', 'ASC')
      .addOrderBy('product.sortOrder', 'ASC')
      .getMany();

    // Extraer productos como lista plana (con categoryId) para facilitar el render en el kiosco
    const products = categories.flatMap((cat) =>
      (cat.products ?? []).map((p) => ({ ...p, categoryId: cat.id })),
    );

    return {
      branch: {
        id: branch.id,
        name: branch.name,
      },
      branchConfig: {
        currency: config.currency,
        taxPercentage: config.taxPercentage,
        tipPercentage: config.tipPercentage,
        inactivitySeconds: config.kioskInactivitySeconds,
      },
      categories: categories.map(({ products: _p, ...cat }) => cat), // categorías sin productos anidados
      products,
    };
  }

  /**
   * Crea una orden desde el kiosko (sin autenticación, sin userId).
   * El branchId viene del parámetro de la URL para evitar que el cliente lo manipule.
   */
  async createOrder(branchId: string, dto: CreateKioskOrderDto): Promise<{
    orderNumber: number;
    total: number;
    tableNumber: number | null;
    message: string;
  }> {
    const config = await this.configRepository.findOne({ where: { branchId } });
    if (!config?.kioskEnabled) {
      throw new NotFoundException('El kiosko no está habilitado para esta sucursal');
    }

    const selectedTable = dto.type === OrderType.DINE_IN
      ? await this.tableRepository.findOne({
        where: { branchId, isActive: true, status: TableStatus.FREE },
        order: { number: 'ASC' },
      })
      : null;

    const effectiveType = dto.type === OrderType.DINE_IN && !selectedTable
      ? OrderType.TAKEOUT
      : dto.type ?? OrderType.KIOSK;

    const order = await this.ordersService.create(
      {
        ...dto,
        branchId,
        type: effectiveType,
        tableId: selectedTable?.id,
        taxPercentage: config.taxPercentage,
        tipPercentage: 0, // kiosko no aplica propina automática
      },
      undefined, // sin userId — orden de kiosko
    );

    const message = selectedTable
      ? `Tu pedido quedó asignado a la mesa ${selectedTable.number}.`
      : dto.type === OrderType.DINE_IN
        ? 'No había mesas libres, por eso tu pedido se registró para llevar.'
        : 'Tu pedido fue registrado para llevar.';

    return {
      orderNumber: order.orderNumber,
      total: order.total,
      tableNumber: selectedTable?.number ?? null,
      message,
    };
  }

  /**
   * Busca un cliente por su código (para lectura de QR en el kiosko).
   */
  async findCustomerByCode(code: string): Promise<Pick<Customer, 'id' | 'code' | 'name' | 'email' | 'loyaltyPoints'>> {
    const customer = await this.customerRepository.findOne({ where: { code, isActive: true } });
    if (!customer) throw new NotFoundException('Cliente no encontrado');
    return { id: customer.id, code: customer.code, name: customer.name, email: customer.email, loyaltyPoints: customer.loyaltyPoints };
  }

  /**
   * Registro rápido desde el kiosko: crea el cliente y envía el QR por email.
   */
  async quickRegister(dto: KioskQuickRegisterDto): Promise<{
    message: string;
    emailSent: boolean;
    code: string;
    qrDataUrl: string;
    customer: Pick<Customer, 'id' | 'code' | 'name' | 'loyaltyPoints'>;
  }> {
    if (dto.email) {
      const existing = await this.customerRepository.findOne({ where: { email: dto.email } });
      if (existing) throw new ConflictException('Ya existe una cuenta con ese email');
    }

    const count = await this.customerRepository.count();
    const code = `CUST-${String(count + 1).padStart(5, '0')}`;
    const customer = await this.customerRepository.save(
      this.customerRepository.create({ name: dto.name, email: dto.email, phone: dto.phone, code }),
    );

    const qrDataUrl = await QRCode.toDataURL(customer.code, { width: 300, margin: 2 });
    let emailSent = false;
    
    if (dto.email) {
      try {
        // Obtener configuración centralizada de correo
        const emailConfig = await this.emailConfigService.getConfig();
        
        if (emailConfig.isEnabled && emailConfig.smtpHost) {
          const base64Image = qrDataUrl.split(',')[1];
          const smtpPass = String(emailConfig.smtpPassword ?? '').replace(/\s+/g, '');

          const transporter = nodemailer.createTransport({
            host: emailConfig.smtpHost,
            port: emailConfig.smtpPort,
            secure: emailConfig.smtpSecure,
            auth: { user: emailConfig.smtpUser, pass: smtpPass },
          });

          await transporter.sendMail({
            from: `${emailConfig.senderName} <${emailConfig.senderEmail}>`,
            to: dto.email,
            subject: '¡Tu código QR de fidelidad está listo! 🎉',
            html: `
              <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb">
                <h2 style="color:#ea580c;margin:0 0 8px">¡Bienvenido, ${customer.name}!</h2>
                <p style="color:#4b5563">Tu código de cliente es: <strong style="font-size:1.2em">${customer.code}</strong></p>
                <p style="color:#4b5563">Presenta el siguiente código QR en el kiosko para acumular puntos en tus pedidos:</p>
                <div style="text-align:center;margin:24px 0">
                  <img src="cid:qrcode" alt="QR Code" style="width:200px;height:200px;border-radius:8px" />
                </div>
                <p style="color:#9ca3af;font-size:0.85em;text-align:center">Puntos actuales: ${customer.loyaltyPoints}</p>
              </div>`,
            attachments: [{ filename: 'qr.png', content: base64Image, encoding: 'base64', cid: 'qrcode' }],
          });
          emailSent = true;
        }
      } catch (_) {
        // Email falla silenciosamente — el registro ya fue creado
      }
    }

    return {
      message: `Registro exitoso. Tu código es ${customer.code}.`,
      emailSent,
      code: customer.code,
      qrDataUrl,
      customer: {
        id: customer.id,
        code: customer.code,
        name: customer.name,
        loyaltyPoints: customer.loyaltyPoints,
      },
    };
  }
}
