import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceItem } from '../../entities';
import { ServiceItemsController } from './service-items.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ServiceItem])],
  controllers: [ServiceItemsController],
})
export class CatalogModule {}
