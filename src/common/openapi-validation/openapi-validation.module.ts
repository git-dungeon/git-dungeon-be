import {
  type DynamicModule,
  Inject,
  Injectable,
  Logger,
  Module,
  type OnModuleInit,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  resolveOpenApiSpecPath,
  resolveOpenApiValidationMode,
} from './openapi-validation.constants';
import { loadOpenApiDocument } from './openapi-loader';
import { normalizeOpenApiDocumentForAjv } from './openapi-normalizer';
import { buildOpenApiOperationIndex } from './openapi-operation-index';
import { OpenApiRequestValidator } from './request-validator';
import {
  OpenApiValidationMiddleware,
  OPENAPI_VALIDATION_RUNTIME,
  type OpenApiValidationRuntime,
} from './validation.middleware';

@Injectable()
class OpenApiValidationBootstrap implements OnModuleInit {
  private readonly fallbackLogger = new Logger(OpenApiValidationBootstrap.name);

  constructor(
    private readonly pinoLogger: PinoLogger,
    @Inject(OPENAPI_VALIDATION_RUNTIME)
    private readonly runtime: OpenApiValidationRuntime,
  ) {}

  async onModuleInit(): Promise<void> {
    const mode = resolveOpenApiValidationMode();
    this.runtime.mode = mode;

    if (mode === 'off') {
      return;
    }

    const specPath = resolveOpenApiSpecPath();
    try {
      const document = await loadOpenApiDocument(specPath);
      const normalized = normalizeOpenApiDocumentForAjv(document);
      const index = buildOpenApiOperationIndex(
        normalized as unknown as Record<string, unknown>,
      );
      this.runtime.validator = new OpenApiRequestValidator(index, {
        warn: (message) => this.pinoLogger.warn(message),
      });
      this.pinoLogger.info(
        { mode, specPath, operations: index.size },
        'OpenAPI request validation initialized',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (this.pinoLogger?.warn) {
        this.pinoLogger.warn(
          { mode, specPath, err: error },
          `OpenAPI request validation disabled: ${message}`,
        );
      } else {
        this.fallbackLogger.warn(
          `OpenAPI request validation disabled: ${message}`,
        );
      }

      if (mode === 'enforce') {
        throw error;
      }
    }
  }
}

@Module({})
export class OpenApiValidationModule {
  static forRoot(): DynamicModule {
    const mode = resolveOpenApiValidationMode();

    return {
      module: OpenApiValidationModule,
      providers: [
        {
          provide: OPENAPI_VALIDATION_RUNTIME,
          useValue: { mode } satisfies OpenApiValidationRuntime,
        },
        OpenApiValidationMiddleware,
        ...(mode === 'off' ? [] : [OpenApiValidationBootstrap]),
      ],
      exports: [OpenApiValidationMiddleware, OPENAPI_VALIDATION_RUNTIME],
    };
  }
}
