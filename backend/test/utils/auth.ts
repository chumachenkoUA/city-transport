import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

export async function loginAs(
  app: INestApplication,
  login: string,
  password: string,
) {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ login, password })
    .expect(201);

  return response.body as {
    token: string;
    roles: string[];
  };
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}
