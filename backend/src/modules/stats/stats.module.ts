import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Dispatch,
  ExceptionEvent,
  RecordItem,
  ServiceItem,
  ServiceRecord,
  Settlement,
  User,
  Visit,
} from '../../entities';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ServiceRecord,
      RecordItem,
      Dispatch,
      Visit,
      ExceptionEvent,
      Settlement,
      ServiceItem,
      User,
    ]),
  ],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
