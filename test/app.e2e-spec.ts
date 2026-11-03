import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createE2eApp, get } from './e2e-app.js';

describe('app wiring, /me and /hubs (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports health at / and /api/health, outside the rate limit', async () => {
    for (const path of ['/', '/api/health']) {
      const res = await get(app, path).expect(200);
      // `time` is the pinned clock: the API and the seed read the same "now".
      expect(res.body).toEqual({ status: 'ok', db: 'up', time: new Date().toISOString() });
      expect(res.headers['ratelimit-policy']).toBeUndefined();
    }
  });

  it('serves the API under /api with helmet, the rate limit and the error envelope', async () => {
    const res = await get(app, '/api/me').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['ratelimit-policy']).toMatch(/q=1000; w=60/);

    await get(app, '/me').expect(404);
    const missing = await get(app, '/api/nope').expect(404);
    expect(missing.body).toEqual({
      statusCode: 404,
      message: 'Cannot GET /api/nope',
      error: 'Not Found',
    });
  });

  it('allows cross-origin calls from CORS_ORIGINS only', async () => {
    const preflight = (origin: string) =>
      request(app.getHttpServer())
        .options('/api/orders')
        .set('Origin', origin)
        .set('Access-Control-Request-Method', 'GET')
        .expect(204);

    const allowed = await preflight('http://localhost:3000');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    const foreign = await preflight('https://elsewhere.example');
    expect(foreign.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('returns the demo user with their company', async () => {
    const res = await get(app, '/api/me').expect(200);
    expect(res.body).toEqual({
      user: {
        id: expect.any(String),
        name: 'User 1',
        initials: 'U1',
        role: 'admin',
        avatarColor: '#5B21B6',
        email: 'user1@rway-transport.example',
      },
      company: { id: expect.any(String), name: 'R-way Transport', balanceCents: 125_000 },
    });
  });

  it('lists the hubs by name', async () => {
    const res = await get(app, '/api/hubs').expect(200);
    expect(res.body).toEqual({
      items: [
        { id: expect.any(String), code: 'MAR', name: 'Markham', province: 'ON' },
        { id: expect.any(String), code: 'TOR', name: 'Toronto', province: 'ON' },
      ],
    });
  });
});
