import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { LoyaltyTransaction } from './entities/loyalty-transaction.entity';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

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

  async create(dto: CreateCustomerDto): Promise<Customer> {
    if (dto.email) {
      const existing = await this.customerRepository.findOne({ where: { email: dto.email } });
      if (existing) {
        throw new ConflictException('Ya existe un cliente con ese email');
      }
    }

    const customer = this.customerRepository.create(dto);
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
