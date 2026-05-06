import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { LoyaltyTransaction } from './entities/loyalty-transaction.entity';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import * as QRCode from 'qrcode';
import * as nodemailer from 'nodemailer';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer) private readonly customerRepository: Repository<Customer>,
    @InjectRepository(LoyaltyTransaction) private readonly loyaltyRepository: Repository<LoyaltyTransaction>,
  ) {}

  findAll(search?: string, isActive?: boolean): Promise<Customer[]> {
    const statusFilter = isActive ?? true;

    if (search) {
      return this.customerRepository.find({
        where: [
          { name: ILike(`%${search}%`), isActive: statusFilter },
          { email: ILike(`%${search}%`), isActive: statusFilter },
          { phone: ILike(`%${search}%`), isActive: statusFilter },
        ],
        take: 20,
      });
    }
    return this.customerRepository.find({ where: { isActive: statusFilter }, order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Customer> {
    const customer = await this.customerRepository.findOne({ where: { id } });
    if (!customer) throw new NotFoundException('Cliente no encontrado');
    return customer;
  }

  async findByCode(code: string): Promise<Customer> {
    const customer = await this.customerRepository.findOne({ where: { code } });
    if (!customer) throw new NotFoundException('Cliente no encontrado');
    return customer;
  }

  async create(dto: CreateCustomerDto): Promise<Customer> {
    if (dto.email) {
      const existing = await this.customerRepository.findOne({ where: { email: dto.email } });
      if (existing) {
        throw new ConflictException('Ya existe un cliente con ese email');
      }
    }

    // Generar código autoincremental
    const count = await this.customerRepository.count();
    const code = `CUST-${String(count + 1).padStart(5, '0')}`;

    const customer = this.customerRepository.create({ ...dto, code });
    return this.customerRepository.save(customer);
  }

  async update(id: string, dto: UpdateCustomerDto): Promise<Customer> {
    if (dto.email) {
      const existing = await this.customerRepository.findOne({ where: { email: dto.email } });
      if (existing && existing.id !== id) {
        throw new ConflictException('Ya existe un cliente con ese email');
      }
    }

    await this.customerRepository.update(id, dto);
    return this.findOne(id);
  }

  async sendQrByEmail(id: string): Promise<{ message: string; email: string; code: string }> {
    const customer = await this.findOne(id);

    if (!customer.email) {
      throw new BadRequestException('El cliente no tiene un correo registrado');
    }

    if (!process.env.SMTP_HOST) {
      throw new BadRequestException('SMTP no está configurado en el servidor');
    }

    if (!customer.code) {
      throw new BadRequestException('El cliente no tiene código QR asignado');
    }

    const qrDataUrl = await QRCode.toDataURL(customer.code, { width: 300, margin: 2 });
    const base64Image = qrDataUrl.split(',')[1];
    const smtpPass = String(process.env.SMTP_PASS ?? '').replace(/\s+/g, '');

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: smtpPass,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: customer.email,
      subject: 'Tu código QR de fidelidad',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb">
          <h2 style="color:#ea580c;margin:0 0 8px">Hola, ${customer.name}</h2>
          <p style="color:#4b5563">Tu código de cliente es: <strong style="font-size:1.2em">${customer.code}</strong></p>
          <p style="color:#4b5563">Presenta el siguiente código QR en el POS o kiosko para acumular puntos:</p>
          <div style="text-align:center;margin:24px 0">
            <img src="cid:qrcode" alt="QR Code" style="width:200px;height:200px;border-radius:8px" />
          </div>
          <p style="color:#9ca3af;font-size:0.85em;text-align:center">Puntos actuales: ${customer.loyaltyPoints}</p>
        </div>`,
      attachments: [{ filename: 'qr.png', content: base64Image, encoding: 'base64', cid: 'qrcode' }],
    });

    return {
      message: `QR enviado a ${customer.email}`,
      email: customer.email,
      code: customer.code,
    };
  }

  async addLoyaltyPoints(customerId: string, points: number, description: string, orderId?: string) {
    await this.customerRepository.increment({ id: customerId }, 'loyaltyPoints', points);
    return this.loyaltyRepository.save({ customerId, points, description, relatedOrderId: orderId });
  }

  getLoyaltyHistory(customerId: string): Promise<LoyaltyTransaction[]> {
    return this.loyaltyRepository.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }
}
