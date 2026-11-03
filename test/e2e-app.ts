import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app-setup.js';

/**
 * The real AppModule with the same middleware, global prefix, CORS and validation
 * as `main.ts` and `serverless.ts` (`configureApp`), serving the database that
 * setup-e2e.ts migrated and seeded.
 */
export async function createE2eApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: ['error', 'warn'] });
  configureApp(app);
  await app.init();
  return app;
}

/** A supertest `GET` on the app (JSON responses arrive parsed in `body`). */
export function get(app: INestApplication, path: string): request.Test {
  return request(app.getHttpServer()).get(path);
}
