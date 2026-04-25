import { Injectable, NotFoundException } from '@nestjs/common';
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

  findAll(search?: string): Promise<Customer[]> {
    if (search) {
      return this.customerRepository.find({
        where: [
          { name: ILike(`%${search}%`), isActive: true },
          { email: ILike(`%${search}%`), isActive: true },
          { phone: ILike(`%${search}%`), isActive: true },
        ],
        take: 20,
      });
    }
    return this.customerRepository.find({ where: { isActive: true }, order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Customer> {
    const customer = await this.customerRepository.findOne({ where: { id } });
    if (!customer) throw new NotFoundException('Cliente no encontrado');
    return customer;
  }

  create(dto: CreateCustomerDto): Promise<Customer> {
    const customer = this.customerRepository.create(dto);
    return this.customerRepository.save(customer);
  }

  async update(id: string, dto: UpdateCustomerDto): Promise<Customer> {
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
