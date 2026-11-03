import { RequestMethod, ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Express, RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import type { AppConfig, RootConfig } from './config/configuration.js';

// helmet types its default export via `export { helmet as default }`, which
// NodeNext resolves inconsistently across build environments (callable locally,
// a non-callable namespace on Vercel's builder). Its runtime default IS the factory.
const helmetMiddleware = helmet as unknown as () => RequestHandler;

const HEALTH_PATHS = new Set(['/', '/api/health']);

/** `perMinute` requests / minute / client IP (per instance), in Nest's error envelope. */
const rateLimiter = (perMinute: number): RequestHandler =>
  rateLimit({
    windowMs: 60_000,
    limit: perMinute,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: (req) => HEALTH_PATHS.has(req.path),
    handler: (_req, res) => {
      res.status(429).json({
        statusCode: 429,
        message: 'Too many requests, please slow down',
        error: 'Too Many Requests',
      });
    },
  });

/**
 * Middleware, prefix, CORS and validation shared by the local server (`main.ts`)
 * and the serverless entry (`serverless.ts`), so the two never drift.
 */
export function configureApp(app: INestApplication): AppConfig {
  const config = app.get(ConfigService<RootConfig, true>).get('app', { infer: true });

  // Behind Vercel's proxy the client IP is in X-Forwarded-For: trust one hop so
  // rate limiting keys on the real client instead of the proxy. Requests proxied
  // by the front may still share one key, hence RATE_LIMIT_PER_MINUTE's high default.
  (app.getHttpAdapter().getInstance() as Express).set('trust proxy', 1);

  app.use(helmetMiddleware());
  app.use(rateLimiter(config.rateLimitPerMinute));
  app.setGlobalPrefix('api', { exclude: [{ path: '/', method: RequestMethod.GET }] });
  // The front proxies /api/* server-side; CORS only matters for direct browser calls.
  app.enableCors({ origin: config.corsOrigins, methods: ['GET', 'HEAD', 'OPTIONS'] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true, // unknown query params → 400
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  return config;
}
