import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from './common/db.module';
import { AuthModule } from './modules/auth.module';
import { CatalogModule } from './modules/catalog.module';
import { RecordsModule } from './modules/records.module';
import { AdminModule } from './modules/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DbModule,
    AuthModule,
    CatalogModule,
    RecordsModule,
    AdminModule,
  ],
})
export class AppModule {}
