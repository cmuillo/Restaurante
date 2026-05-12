import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DebitNote } from './entities/debit-note.entity';
import { Invoice } from '../billing/entities/invoice.entity';
import { DebitNotesService } from './debit-notes.service';
import { DebitNotesController } from './debit-notes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DebitNote, Invoice])],
  providers: [DebitNotesService],
  controllers: [DebitNotesController],
  exports: [DebitNotesService],
})
export class DebitNotesModule {}
