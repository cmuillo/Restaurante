import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Table } from './entities/table.entity';
import { TablesController } from './tables.controller';
import { TablesService } from './tables.service';
import { WebsocketsModule } from '../websockets/websockets.module';

@Module({
  imports: [TypeOrmModule.forFeature([Table]), WebsocketsModule],
  controllers: [TablesController],
  providers: [TablesService],
  exports: [TablesService],
})
export class TablesModule {}
