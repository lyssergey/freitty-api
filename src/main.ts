import 'reflect-metadata';
import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app-setup.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = configureApp(app);
  app.enableShutdownHooks();
  await app.listen(config.port);
  new Logger('Bootstrap').log(`Freitty API listening on http://localhost:${config.port}/api`);
}

void bootstrap();
