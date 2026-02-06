import {
  type DynamicModule,
  Inject,
  Injectable,
  Logger,
  Module,
  type OnModuleInit,
} from '@nestjs/common';
import {
  resolveOpenApiValidationMode,
  resolveOpenApiSpecPath,
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

type OpenApiValidatorCache = {
  validator: OpenApiRequestValidator;
  operations: number;
};

const validatorCacheState: {
  specPath?: string;
  validatorPromise?: Promise<OpenApiValidatorCache>;
} = {};

export const resetOpenApiValidationCacheForTest = (): void => {
  validatorCacheState.specPath = undefined;
  validatorCacheState.validatorPromise = undefined;
};

const getOrCreateRequestValidator = async (
  specPath: string,
  warn: (message: string) => void,
): Promise<OpenApiValidatorCache> => {
  if (
    validatorCacheState.specPath === specPath &&
    validatorCacheState.validatorPromise
  ) {
    return validatorCacheState.validatorPromise;
  }

  validatorCacheState.specPath = specPath;
  validatorCacheState.validatorPromise = (async () => {
    const document = await loadOpenApiDocument(specPath);
    const normalized = normalizeOpenApiDocumentForAjv(document);
    const index = buildOpenApiOperationIndex(
      normalized as unknown as Record<string, unknown>,
    );

    return {
      validator: new OpenApiRequestValidator(index, { warn }),
      operations: index.size,
    };
  })();

  try {
    return await validatorCacheState.validatorPromise;
  } catch (error) {
    validatorCacheState.validatorPromise = undefined;
    throw error;
  }
};

@Injectable()
class OpenApiValidationBootstrap implements OnModuleInit {
  private readonly logger = new Logger(OpenApiValidationBootstrap.name);

  constructor(
    @Inject(OPENAPI_VALIDATION_RUNTIME)
    private readonly runtime: OpenApiValidationRuntime,
  ) {}

  async onModuleInit(): Promise<void> {
    const mode = resolveOpenApiValidationMode();
    this.runtime.mode = mode;
    if (mode === 'off') {
      this.logger.log('OpenAPI request validation is disabled (mode=off).');
      return;
    }

    const specPath = resolveOpenApiSpecPath();
    try {
      const { validator, operations } = await getOrCreateRequestValidator(
        specPath,
        (message) => this.logger.warn(message),
      );
      this.runtime.validator = validator;
      this.logger.log(
        `OpenAPI request validation initialized (mode=${mode}, operations=${operations}, specPath=${specPath})`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (mode === 'report') {
        this.logger.warn(
          `OpenAPI request validation initialization failed in report mode: ${message} (specPath=${specPath})`,
        );
        return;
      }

      this.logger.error(
        `OpenAPI request validation initialization failed: ${message} (specPath=${specPath})`,
      );
      throw error;
    }
  }
}

@Module({})
export class OpenApiValidationModule {
  static forRoot(): DynamicModule {
    return {
      module: OpenApiValidationModule,
      providers: [
        {
          provide: OPENAPI_VALIDATION_RUNTIME,
          useValue: {
            mode: resolveOpenApiValidationMode(),
          } satisfies OpenApiValidationRuntime,
        },
        OpenApiValidationMiddleware,
        OpenApiValidationBootstrap,
      ],
      exports: [OpenApiValidationMiddleware, OPENAPI_VALIDATION_RUNTIME],
    };
  }
}
