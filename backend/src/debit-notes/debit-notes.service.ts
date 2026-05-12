import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DebitNote, DebitNoteStatus } from './entities/debit-note.entity';
import { Invoice } from '../billing/entities/invoice.entity';
import { CreateDebitNoteDto, CancelDebitNoteDto } from './dto/create-debit-note.dto';

@Injectable()
export class DebitNotesService {
  constructor(
    @InjectRepository(DebitNote)
    private debitNotesRepository: Repository<DebitNote>,
    @InjectRepository(Invoice)
    private invoicesRepository: Repository<Invoice>,
  ) {}

  /**
   * Crear una nueva Nota de Débito
   * - Valida que la factura exista y sea de la misma rama
   * - No tiene límite de monto (puede ser para intereses, gastos, etc)
   */
  async create(branchId: string, dto: CreateDebitNoteDto, userId: string): Promise<DebitNote> {
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

    if (dto.amount <= 0) {
      throw new BadRequestException('El monto debe ser mayor a 0');
    }

    // Generar número de ND
    const lastDN = await this.debitNotesRepository.findOne({
      where: { branchId },
      order: { createdAt: 'DESC' },
    });
    const number = lastDN ? parseInt(lastDN.debitNoteNumber.split('-')[1]) + 1 : 1;
    const debitNoteNumber = `ND-${String(number).padStart(6, '0')}`;

    const debitNote = this.debitNotesRepository.create({
      branchId,
      invoiceId: dto.invoiceId,
      debitNoteNumber,
      reason: dto.reason,
      amount: dto.amount,
      description: dto.description,
      status: DebitNoteStatus.ISSUED,
      createdByUserId: userId,
      printable: {
        invoiceNumber: invoice.invoiceNumber,
        invoiceTotal: invoice.total,
        debitNoteAmount: dto.amount,
        debitNoteReason: dto.reason,
      },
    });

    return this.debitNotesRepository.save(debitNote);
  }

  /**
   * Obtener todas las ND de una rama
   */
  async findAll(branchId: string, status?: DebitNoteStatus): Promise<DebitNote[]> {
    const query = this.debitNotesRepository
      .createQueryBuilder('dn')
      .where('dn.branchId = :branchId', { branchId })
      .leftJoinAndSelect('dn.invoice', 'invoice')
      .leftJoinAndSelect('dn.createdByUser', 'createdByUser');

    if (status) {
      query.andWhere('dn.status = :status', { status });
    }

    return query.orderBy('dn.createdAt', 'DESC').getMany();
  }

  /**
   * Obtener una ND por ID
   */
  async findOne(id: string, branchId: string): Promise<DebitNote> {
    const debitNote = await this.debitNotesRepository.findOne({
      where: { id, branchId },
      relations: ['invoice', 'createdByUser', 'cancelledByUser'],
    });

    if (!debitNote) {
      throw new NotFoundException(`Nota de Débito ${id} no encontrada`);
    }

    return debitNote;
  }

  /**
   * Anular una ND
   */
  async cancel(id: string, branchId: string, dto: CancelDebitNoteDto, userId: string): Promise<DebitNote> {
    const debitNote = await this.findOne(id, branchId);

    if (debitNote.status === DebitNoteStatus.CANCELLED) {
      throw new BadRequestException('La ND ya fue anulada');
    }

    debitNote.status = DebitNoteStatus.CANCELLED;
    debitNote.cancelledByUserId = userId;
    debitNote.cancellationReason = dto.cancellationReason;
    debitNote.cancelledAt = new Date();

    return this.debitNotesRepository.save(debitNote);
  }
}
