import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface HealthReport {
  status: 'ok';
  db: 'up' | 'down';
  time: string;
}

const DB_PING_TIMEOUT_MS = 3000;

@Injectable()
export class HealthService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** The process answers (`status: ok`); `db` tells whether Postgres does too. */
  async check(): Promise<HealthReport> {
    return {
      status: 'ok',
      db: (await this.pingDatabase()) ? 'up' : 'down',
      time: new Date().toISOString(),
    };
  }

  private async pingDatabase(): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), DB_PING_TIMEOUT_MS);
    });
    try {
      const ping = this.dataSource.query('SELECT 1').then(
        () => true,
        () => false,
      );
      return await Promise.race([ping, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}
