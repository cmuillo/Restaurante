import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreditNote, CreditNoteStatus } from './entities/credit-note.entity';
import { Invoice } from '../billing/entities/invoice.entity';
import { CreateCreditNoteDto, CancelCreditNoteDto } from './dto/create-credit-note.dto';

@Injectable()
export class CreditNotesService {
  constructor(
    @InjectRepository(CreditNote)
    private creditNotesRepository: Repository<CreditNote>,
    @InjectRepository(Invoice)
    private invoicesRepository: Repository<Invoice>,
  ) {}

  /**
   * Crear una nueva Nota de Crédito
   * - Valida que la factura exista y sea de la misma rama
   * - Valida que el monto no exceda el monto original de la factura
   */
  async create(branchId: string, dto: CreateCreditNoteDto, userId: string): Promise<CreditNote> {
    const invoice = await this.invoicesRepository.findOne({
      where: { id: dto.invoiceId },
      relations: ['order'],
    });

    if (!invoice) {
      throw new NotFoundException(`Factura ${dto.invoiceId} no encontrada`);
    }

    if (invoice.order.branchId !== branchId) {
      throw new BadRequestException('La factura no pertenece a esta rama');
    }

    // Validar que la NC no exceda el monto total de la factura
    if (dto.amount > invoice.total) {
      throw new BadRequestException(
        `Monto de NC (${dto.amount}) no puede exceder el total de la factura (${invoice.total})`
      );
    }

    if (dto.amount <= 0) {
      throw new BadRequestException('El monto debe ser mayor a 0');
    }

    // Generar número de NC
    const lastCN = await this.creditNotesRepository.findOne({
      where: { branchId },
      order: { createdAt: 'DESC' },
    });
    const number = lastCN ? parseInt(lastCN.creditNoteNumber.split('-')[1]) + 1 : 1;
    const creditNoteNumber = `NC-${String(number).padStart(6, '0')}`;

    const creditNote = this.creditNotesRepository.create({
      branchId,
      invoiceId: dto.invoiceId,
      creditNoteNumber,
      reason: dto.reason,
      amount: dto.amount,
      description: dto.description,
      status: CreditNoteStatus.ISSUED,
      createdByUserId: userId,
      printable: {
        invoiceNumber: invoice.invoiceNumber,
        invoiceTotal: invoice.total,
        creditNoteAmount: dto.amount,
        creditNoteReason: dto.reason,
      },
    });

    return this.creditNotesRepository.save(creditNote);
  }

  /**
   * Obtener todas las NC de una rama
   */
  async findAll(branchId: string, status?: CreditNoteStatus): Promise<CreditNote[]> {
    const query = this.creditNotesRepository
      .createQueryBuilder('cn')
      .where('cn.branchId = :branchId', { branchId })
      .leftJoinAndSelect('cn.invoice', 'invoice')
      .leftJoinAndSelect('cn.createdByUser', 'createdByUser');

    if (status) {
      query.andWhere('cn.status = :status', { status });
    }

    return query.orderBy('cn.createdAt', 'DESC').getMany();
  }

  /**
   * Obtener una NC por ID
   */
  async findOne(id: string, branchId: string): Promise<CreditNote> {
    const creditNote = await this.creditNotesRepository.findOne({
      where: { id, branchId },
      relations: ['invoice', 'createdByUser', 'cancelledByUser'],
    });

    if (!creditNote) {
      throw new NotFoundException(`Nota de Crédito ${id} no encontrada`);
    }

    return creditNote;
  }

  /**
   * Anular una NC
   */
  async cancel(id: string, branchId: string, dto: CancelCreditNoteDto, userId: string): Promise<CreditNote> {
    const creditNote = await this.findOne(id, branchId);

    if (creditNote.status === CreditNoteStatus.CANCELLED) {
      throw new BadRequestException('La NC ya fue anulada');
    }

    creditNote.status = CreditNoteStatus.CANCELLED;
    creditNote.cancelledByUserId = userId;
    creditNote.cancellationReason = dto.cancellationReason;
    creditNote.cancelledAt = new Date();

    return this.creditNotesRepository.save(creditNote);
  }
}
