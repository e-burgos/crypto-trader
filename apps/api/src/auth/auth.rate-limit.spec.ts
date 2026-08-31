import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import {
  AUTH_THROTTLER,
  AuthController,
  LOGIN_RATE_LIMIT,
  REGISTER_RATE_LIMIT,
} from './auth.controller';
import { AuthService } from './auth.service';

@Controller('unthrottled')
class UnthrottledController {
  @Get()
  ping() {
    return { ok: true };
  }
}

describe('Auth rate limiting', () => {
  let app: INestApplication;
  let baseUrl: string;
  const authService = {
    login: jest.fn().mockResolvedValue({ accessToken: 'access' }),
    register: jest.fn().mockResolvedValue({ accessToken: 'access' }),
    refresh: jest.fn().mockResolvedValue({ accessToken: 'access' }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [{ name: AUTH_THROTTLER, ...LOGIN_RATE_LIMIT }],
        }),
      ],
      controllers: [AuthController, UnthrottledController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterEach(async () => {
    await app.close();
  });

  const post = (path: string, body: unknown) =>
    fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  const credentials = { email: 'attacker@example.com', password: 'guess' };

  const repeat = async (times: number, request: () => Promise<Response>) => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < times; attempt++) {
      statuses.push((await request()).status);
    }
    return statuses;
  };

  it('serves every login attempt below the limit unchanged', async () => {
    const statuses = await repeat(LOGIN_RATE_LIMIT.limit, () =>
      post('/auth/login', credentials),
    );

    expect(statuses).toEqual(Array(LOGIN_RATE_LIMIT.limit).fill(200));
    expect(authService.login).toHaveBeenCalledTimes(LOGIN_RATE_LIMIT.limit);
  });

  it('answers 429 once login attempts exceed the limit', async () => {
    await repeat(LOGIN_RATE_LIMIT.limit, () => post('/auth/login', credentials));

    const blocked = await post('/auth/login', credentials);

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after-auth')).toBeTruthy();
    expect(authService.login).toHaveBeenCalledTimes(LOGIN_RATE_LIMIT.limit);
  });

  it('exposes the remaining budget while under the limit', async () => {
    const first = await post('/auth/login', credentials);

    expect(first.headers.get('x-ratelimit-limit-auth')).toBe(
      String(LOGIN_RATE_LIMIT.limit),
    );
    expect(first.headers.get('x-ratelimit-remaining-auth')).toBe(
      String(LOGIN_RATE_LIMIT.limit - 1),
    );
  });

  it('answers 429 once register attempts exceed their own limit', async () => {
    const allowed = await repeat(REGISTER_RATE_LIMIT.limit, () =>
      post('/auth/register', { ...credentials, name: 'Attacker' }),
    );
    const blocked = await post('/auth/register', {
      ...credentials,
      name: 'Attacker',
    });

    expect(allowed).toEqual(Array(REGISTER_RATE_LIMIT.limit).fill(201));
    expect(blocked.status).toBe(429);
    expect(authService.register).toHaveBeenCalledTimes(
      REGISTER_RATE_LIMIT.limit,
    );
  });

  it('counts login and register against separate budgets', async () => {
    await repeat(LOGIN_RATE_LIMIT.limit + 1, () =>
      post('/auth/login', credentials),
    );

    const register = await post('/auth/register', {
      ...credentials,
      name: 'Attacker',
    });

    expect(register.status).toBe(201);
  });

  it('leaves the rest of the auth surface unthrottled', async () => {
    const statuses = await repeat(LOGIN_RATE_LIMIT.limit * 2, () =>
      post('/auth/refresh', { refreshToken: 'token' }),
    );

    expect(statuses.every((status) => status === 200)).toBe(true);
  });

  it('leaves controllers outside auth unthrottled', async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < LOGIN_RATE_LIMIT.limit * 3; attempt++) {
      statuses.push((await fetch(`${baseUrl}/unthrottled`)).status);
    }

    expect(statuses.every((status) => status === 200)).toBe(true);
  });
});
