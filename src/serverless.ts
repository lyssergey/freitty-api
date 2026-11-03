import 'reflect-metadata';
import 'dotenv/config';
import express from 'express';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app-setup.js';

/**
 * Vercel serverless entry (re-exported by `api/index.js`). The Nest app is built
 * once per warm instance and its Express instance serves every invocation. The
 * code is compiled ahead of time by `nest build` (tsc keeps decorator metadata);
 * migrations run separately (`npm run db:migrate`), never on a cold start.
 */
let server: Promise<express.Express> | null = null;

async function bootstrap(): Promise<express.Express> {
  const instance = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(instance));
  configureApp(app);
  await app.init(); // not listen(): Vercel owns the HTTP server
  return instance;
}

export default async function handler(req: express.Request, res: express.Response): Promise<void> {
  server ??= bootstrap().catch((err: unknown) => {
    server = null; // let the next invocation retry a failed cold start
    throw err;
  });
  (await server)(req, res);
}
