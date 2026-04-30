import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ApiExceptionFilter } from './api-exception.filter';
import { createValidationException } from './validation-exception.factory';

export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api');
  app.enableCors();
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      exceptionFactory: createValidationException,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      whitelist: true
    })
  );

  return app;
}
