import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Course,
  Dispatch,
  ExceptionEvent,
  FollowUp,
  HealthProfile,
  RecordItem,
  Referral,
  RiskAssessment,
  ServiceItem,
  ServiceRecord,
  Settlement,
  User,
  Visit,
} from '../../entities';
import { RecordsController } from './records.controller';
import { RecordsService } from './records.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ServiceRecord,
      RecordItem,
      RiskAssessment,
      Dispatch,
      Visit,
      Course,
      ServiceItem,
      HealthProfile,
      ExceptionEvent,
      Settlement,
      FollowUp,
      Referral,
      User,
    ]),
  ],
  controllers: [RecordsController],
  providers: [RecordsService],
  exports: [RecordsService],
})
export class RecordsModule {}
