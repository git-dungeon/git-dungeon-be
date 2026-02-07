import Ajv, { type AnySchema, type ValidateFunction } from 'ajv';
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

type PathTemplateMatcher = {
  method: string;
  regexp: RegExp;
  spec: OpenApiOperationSpec;
};

export type OpenApiValidationResult = {
  ok: boolean;
  issues?: ReturnType<typeof formatAjvIssues>;
};

const normalizeRequestPath = (path: string): string => {
  if (!path.startsWith('/')) {
    return `/${path}`;
  }
  return path;
};

const escapeRegExp = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const buildPathTemplateRegExp = (path: string): RegExp => {
  const escaped = escapeRegExp(path);
  const pattern = escaped.replace(/\\\{[^/{}]+\\\}/g, '[^/]+');
  return new RegExp(`^${pattern}$`);
};

export class OpenApiRequestValidator {
  private readonly ajv: Ajv;
  private readonly queryValidators = new Map<string, ValidateFunction>();
  private readonly paramsValidators = new Map<string, ValidateFunction>();
  private readonly bodyValidators = new Map<string, ValidateFunction>();
  private readonly templateMatchers: PathTemplateMatcher[] = [];

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
      if (spec.path.includes('{') && spec.path.includes('}')) {
        this.templateMatchers.push({
          method: spec.method,
          regexp: buildPathTemplateRegExp(spec.path),
          spec,
        });
      }
    }
  }

  findOperation(
    method: string,
    path: string,
  ): OpenApiOperationSpec | undefined {
    const normalizedPath = normalizeRequestPath(path);
    const exact = this.index.get(buildIndexKey(method, normalizedPath));
    if (exact) {
      return exact;
    }

    const normalizedMethod = method.toLowerCase();
    return this.templateMatchers.find((matcher) => {
      return (
        matcher.method === normalizedMethod &&
        matcher.regexp.test(normalizedPath)
      );
    })?.spec;
  }

  validateQuery(
    spec: OpenApiOperationSpec,
    query: unknown,
  ): OpenApiValidationResult {
    return this.validateWithMap(
      spec,
      spec.querySchema,
      this.queryValidators,
      query,
    );
  }

  validateParams(
    spec: OpenApiOperationSpec,
    params: unknown,
  ): OpenApiValidationResult {
    return this.validateWithMap(
      spec,
      spec.paramsSchema,
      this.paramsValidators,
      params,
    );
  }

  validateBody(
    spec: OpenApiOperationSpec,
    body: unknown,
  ): OpenApiValidationResult {
    return this.validateWithMap(
      spec,
      spec.bodySchema,
      this.bodyValidators,
      body,
    );
  }

  private compileOperation(spec: OpenApiOperationSpec): void {
    const key = buildIndexKey(spec.method, spec.path);

    const tryCompile = (
      label: 'query' | 'params' | 'body',
      schema: unknown,
      target: Map<string, ValidateFunction>,
    ): void => {
      try {
        target.set(key, this.ajv.compile(schema as AnySchema));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const fullMessage = `OpenAPI validator compile failed for ${key} (${label}): ${message}`;
        this.logger?.warn?.(fullMessage);
        throw new Error(fullMessage);
      }
    };

    if (spec.querySchema) {
      tryCompile('query', spec.querySchema, this.queryValidators);
    }
    if (spec.paramsSchema) {
      tryCompile('params', spec.paramsSchema, this.paramsValidators);
    }
    if (spec.bodySchema) {
      tryCompile('body', spec.bodySchema, this.bodyValidators);
    }
  }

  private validateWithMap(
    spec: OpenApiOperationSpec,
    schema: unknown,
    validators: Map<string, ValidateFunction>,
    payload: unknown,
  ): OpenApiValidationResult {
    if (!schema) {
      return { ok: true };
    }

    const key = buildIndexKey(spec.method, spec.path);
    const validator = validators.get(key);
    if (!validator) {
      return { ok: true };
    }

    const ok = validator(payload);
    if (ok) {
      return { ok: true };
    }

    return {
      ok: false,
      issues: formatAjvIssues(validator.errors),
    };
  }
}
