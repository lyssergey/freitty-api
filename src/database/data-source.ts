import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { configuration } from '../config/configuration.js';
import { buildDataSourceOptions } from './data-source-options.js';

/**
 * Standalone DataSource for the TypeORM CLI (`npm run migration:generate`, loaded
 * from `dist`) and the db scripts (migrations, seed). Same options as the app.
 */
export default new DataSource(buildDataSourceOptions(configuration().app.database));
