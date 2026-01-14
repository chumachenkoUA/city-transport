import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PostgresExceptionFilter } from '../../src/common/filters/postgres-exception.filter';
import { TransformInterceptor } from '../../src/common/interceptors/transform.interceptor';

let app: INestApplication | null = null;
let appPromise: Promise<INestApplication> | null = null;
let appUsers = 0;

export async function getTestApp(): Promise<INestApplication> {
  if (app) {
    appUsers += 1;
    return app;
  }

  if (!appPromise) {
    appPromise = (async () => {
      process.env.SEED_ON_START = 'false';
      const moduleFixture = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      const instance = moduleFixture.createNestApplication();

      // Match global config from main.ts
      instance.useGlobalFilters(new PostgresExceptionFilter());
      instance.useGlobalInterceptors(new TransformInterceptor());
      instance.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );

      await instance.init();
      return instance;
    })();
  }

  app = await appPromise;
  appUsers += 1;
  return app;
}

export async function releaseTestApp(): Promise<void> {
  appUsers = Math.max(0, appUsers - 1);
  if (app && appUsers === 0) {
    await app.close();
    app = null;
    appPromise = null;
  }
}
