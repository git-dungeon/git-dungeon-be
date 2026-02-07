import type { CanActivate, INestApplication } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';

export interface TestingAppOptions {
  overrideProviders?: Array<{
    provide: unknown;
    useValue: unknown;
  }>;
  globalGuards?: CanActivate[];
}

export const createTestingApp = async (
  options: TestingAppOptions = {},
): Promise<INestApplication> => {
  const { AppModule } = await import('../app.module');

  const builder: TestingModuleBuilder = Test.createTestingModule({
    imports: [AppModule],
  });

  for (const override of options.overrideProviders ?? []) {
    builder
      .overrideProvider(override.provide as never)
      .useValue(override.useValue as never);
  }

  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  app.useLogger(app.get(Logger));

  for (const guard of options.globalGuards ?? []) {
    app.useGlobalGuards(guard);
  }

  await app.init();

  return app;
};
