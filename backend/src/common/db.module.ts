import { Module, OnModuleInit, Logger, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

export const PG_POOL = 'PG_POOL';

@Injectable()
class DbInit {
  private readonly logger = new Logger('DbInit');
  constructor(private readonly config: ConfigService) {}

  async runMigrations() {
    const pool = new Pool({
      host: this.config.get('DB_HOST', 'localhost'),
      port: Number(this.config.get('DB_PORT', 5432)),
      user: this.config.get('DB_USER', 'appuser'),
      password: this.config.get('DB_PASSWORD', ''),
      database: this.config.get('DB_NAME', 'physio'),
    });
    const dir = path.join(__dirname, '..', '..', 'migrations');
    const files = fs.existsSync(dir)
      ? fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
      : [];
    for (const file of files) {
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      this.logger.log(`执行迁移: ${file}`);
      await pool.query(sql);
    }
    if (files.some((f) => f.includes('seed'))) {
      this.logger.log('种子数据已随迁移加载（幂等，可重复启动）');
    }
    await pool.end();
  }
}

@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Pool({
          host: config.get('DB_HOST', 'localhost'),
          port: Number(config.get('DB_PORT', 5432)),
          user: config.get('DB_USER', 'appuser'),
          password: config.get('DB_PASSWORD', ''),
          database: config.get('DB_NAME', 'physio'),
          max: 10,
        }),
    },
    DbInit,
  ],
  exports: [PG_POOL],
})
export class DbModule implements OnModuleInit {
  constructor(private readonly dbInit: DbInit) {}
  async onModuleInit() {
    await this.dbInit.runMigrations();
  }
}
