import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { RootConfig } from '../config/configuration.js';
import { buildDataSourceOptions } from './data-source-options.js';

/** Wires TypeORM from validated config, with the same options as the CLI data source. */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<RootConfig, true>) => ({
        ...buildDataSourceOptions(config.get('app', { infer: true }).database),
        // Fail a cold start fast instead of Nest's default 9 attempts × 3 s.
        retryAttempts: 2,
        retryDelay: 1000,
      }),
    }),
  ],
})
export class DatabaseModule {}
