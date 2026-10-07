import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { JwtAuthGuard } from './common/jwt-auth.guard';
import { RolesGuard } from './common/roles.guard';
import { ALL_ENTITIES } from './entities';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { ExceptionsModule } from './modules/exceptions/exceptions.module';
import { RecordsModule } from './modules/records/records.module';
import { SettlementsModule } from './modules/settlements/settlements.module';
import { StatsModule } from './modules/stats/stats.module';
import { UsersModule } from './modules/users/users.module';
import { SeedModule } from './seed/seed.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'physio',
      password: process.env.DB_PASS || 'physio123',
      database: process.env.DB_NAME || 'physio',
      entities: ALL_ENTITIES,
      synchronize: true, // 演示环境自动建表；生产应改为迁移
    }),
    AuthModule,
    UsersModule,
    CatalogModule,
    RecordsModule,
    ExceptionsModule,
    SettlementsModule,
    StatsModule,
    SeedModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
