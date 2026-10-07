import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthProfile, ServiceItem, TherapistProfile, User } from '../entities';
import { RecordsModule } from '../modules/records/records.module';
import { SettlementsModule } from '../modules/settlements/settlements.module';
import { SeedService } from './seed.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, HealthProfile, TherapistProfile, ServiceItem]),
    RecordsModule,
    SettlementsModule,
  ],
  providers: [SeedService],
})
export class SeedModule {}
