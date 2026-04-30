import { Body, Controller, ForbiddenException, Get, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsString, Length } from 'class-validator';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configureApp } from './configure-app';
import { createValidationException } from './validation-exception.factory';

class ValidationBodyDto {
  @IsString()
  @Length(2, 20)
  name!: string;
}

@Controller('qa-errors')
class QaErrorsController {
  @Post('validation')
  validateBody(@Body() body: ValidationBodyDto) {
    if (body.name.length < 2 || 'unexpected' in body) {
      throw createValidationException([
        {
          children: [],
          constraints: {
            isLength: 'name must be longer than or equal to 2 characters'
          },
          property: 'name',
          target: body,
          value: body.name
        },
        {
          children: [],
          constraints: {
            whitelistValidation: 'property unexpected should not exist'
          },
          property: 'unexpected',
          target: body,
          value: (body as { unexpected?: unknown }).unexpected
        }
      ]);
    }

    return body;
  }

  @Get('forbidden')
  forbidden() {
    throw new ForbiddenException('No access');
  }

  @Get('db-conflict')
  databaseConflict() {
    throw {
      code: '23505',
      constraint: 'users_email_key',
      table: 'users'
    };
  }
}

describe('API exception filter and validation pipe', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns a stable validation error shape and rejects unknown fields', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/qa-errors/validation')
      .send({ name: 'a', unexpected: true })
      .expect(400);

    expect(response.body).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      path: '/api/qa-errors/validation',
      statusCode: 400
    });
    expect(response.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'name' }),
        expect.objectContaining({ field: 'unexpected' })
      ])
    );
    expect(response.body.timestamp).toEqual(expect.any(String));
  });

  it('returns a stable forbidden error shape', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/qa-errors/forbidden')
      .expect(403);

    expect(response.body).toMatchObject({
      code: 'FORBIDDEN',
      message: 'No access',
      path: '/api/qa-errors/forbidden',
      statusCode: 403
    });
  });

  it('maps postgres unique violations to 409 conflict', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/qa-errors/db-conflict')
      .expect(409);

    expect(response.body).toMatchObject({
      code: 'CONFLICT',
      details: {
        constraint: 'users_email_key',
        table: 'users'
      },
      message: 'Resource already exists',
      statusCode: 409
    });
  });
});

async function createTestApp() {
  const moduleRef = await Test.createTestingModule({
    controllers: [QaErrorsController]
  }).compile();
  const app = moduleRef.createNestApplication();

  configureApp(app);
  await app.init();

  return app;
}
