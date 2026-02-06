import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import {
  buildIndexKey,
  type OpenApiOperationSpec,
  type OperationIndex,
} from './openapi-operation-index';
import { formatAjvIssues } from './validation.errors';

type LoggerLike = {
  warn?: (message: string) => void;
};

export type OpenApiValidationResult = {
  ok: boolean;
  issues?: ReturnType<typeof formatAjvIssues>;
};

export class OpenApiRequestValidator {
  private readonly ajv: Ajv;
  private readonly queryValidators = new Map<string, ValidateFunction>();
  private readonly paramsValidators = new Map<string, ValidateFunction>();
  private readonly bodyValidators = new Map<string, ValidateFunction>();

  constructor(
    private readonly index: OperationIndex,
    private readonly logger?: LoggerLike,
    options?: { coerceTypes?: boolean },
  ) {
    this.ajv = new Ajv({
      allErrors: true,
      strict: false,
      coerceTypes: options?.coerceTypes ?? true,
      useDefaults: true,
    });
    addFormats(this.ajv);

    for (const spec of index.values()) {
      this.compileOperation(spec);
    }
  }

  findOperation(
    method: string,
    path: string,
  ): OpenApiOperationSpec | undefined {
    return this.index.get(buildIndexKey(method, path));
  }

  validateQuery(
    spec: OpenApiOperationSpec,
    query: unknown,
  ): OpenApiValidationResult {
    if (!spec.querySchema) {
      return { ok: true };
    }

    const key = buildIndexKey(spec.method, spec.path);
    const validator = this.queryValidators.get(key);
    if (!validator) {
      return { ok: true };
    }

    const ok = validator(query);
    if (ok) {
      return { ok: true };
    }

    return {
      ok: false,
      issues: formatAjvIssues(validator.errors),
    };
  }

  validateParams(
    spec: OpenApiOperationSpec,
    params: unknown,
  ): OpenApiValidationResult {
    if (!spec.paramsSchema) {
      return { ok: true };
    }

    const key = buildIndexKey(spec.method, spec.path);
    const validator = this.paramsValidators.get(key);
    if (!validator) {
      return { ok: true };
    }

    const ok = validator(params);
    if (ok) {
      return { ok: true };
    }

    return {
      ok: false,
      issues: formatAjvIssues(validator.errors),
    };
  }

  validateBody(
    spec: OpenApiOperationSpec,
    body: unknown,
  ): OpenApiValidationResult {
    if (!spec.bodySchema) {
      return { ok: true };
    }

    const key = buildIndexKey(spec.method, spec.path);
    const validator = this.bodyValidators.get(key);
    if (!validator) {
      return { ok: true };
    }

    const ok = validator(body);
    if (ok) {
      return { ok: true };
    }

    return {
      ok: false,
      issues: formatAjvIssues(validator.errors),
    };
  }

  private compileOperation(spec: OpenApiOperationSpec): void {
    const key = buildIndexKey(spec.method, spec.path);

    try {
      if (spec.querySchema) {
        this.queryValidators.set(key, this.ajv.compile(spec.querySchema));
      }
      if (spec.paramsSchema) {
        this.paramsValidators.set(key, this.ajv.compile(spec.paramsSchema));
      }
      if (spec.bodySchema) {
        this.bodyValidators.set(key, this.ajv.compile(spec.bodySchema));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger?.warn?.(
        `OpenAPI validator compile failed for ${key}: ${message}`,
      );
    }
  }
}
