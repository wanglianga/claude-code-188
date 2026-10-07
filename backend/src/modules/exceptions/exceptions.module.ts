import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dispatch, ExceptionEvent, ServiceRecord } from '../../entities';
import { ExceptionsController } from './exceptions.controller';
import { ExceptionsService } from './exceptions.service';

@Module({
  imports: [TypeOrmModule.forFeature([ExceptionEvent, ServiceRecord, Dispatch])],
  controllers: [ExceptionsController],
  providers: [ExceptionsService],
})
export class ExceptionsModule {}
