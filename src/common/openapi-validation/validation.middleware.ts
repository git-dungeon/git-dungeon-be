import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../http/api-response';
import type { OpenApiOperationSpec } from './openapi-operation-index';
import { resolveOpenApiValidationMode } from './openapi-validation.constants';
import type { OpenApiRequestValidator } from './request-validator';
import { resolveOpenApiValidationErrorShape } from './validation-error-code';

export type OpenApiValidationContext = {
  requestId?: string;
  method: string;
  path: string;
};

export type OpenApiValidationMode = ReturnType<
  typeof resolveOpenApiValidationMode
>;

export interface OpenApiValidationRuntime {
  mode: OpenApiValidationMode;
  validator?: OpenApiRequestValidator;
}

export const OPENAPI_VALIDATION_RUNTIME = 'OPENAPI_VALIDATION_RUNTIME';

@Injectable()
export class OpenApiValidationMiddleware implements NestMiddleware {
  constructor(
    @Inject(OPENAPI_VALIDATION_RUNTIME)
    private readonly runtime: OpenApiValidationRuntime,
  ) {}

  use(req: Request & { id?: string }, res: Response, next: NextFunction): void {
    const mode = this.runtime.mode;
    if (mode === 'off') {
      next();
      return;
    }

    const validator = this.runtime.validator;
    if (!validator) {
      next();
      return;
    }

    const path = req.path;
    const method = req.method.toLowerCase();
    const operation = validator.findOperation(method, path);
    if (!operation) {
      next();
      return;
    }

    const context: OpenApiValidationContext = {
      requestId: req.id,
      method,
      path,
    };

    const result = this.validateRequest(operation, req);
    if (result.ok) {
      next();
      return;
    }

    if (mode === 'report') {
      next();
      return;
    }

    const errorShape = resolveOpenApiValidationErrorShape(operation);

    res.status(400).json(
      errorResponse(
        {
          code: errorShape.code,
          message: errorShape.message,
          details: {
            ...context,
            source: result.source,
            issues: result.issues,
          },
        },
        {
          requestId: req.id,
          generatedAt: new Date().toISOString(),
        },
      ),
    );
  }

  private validateRequest(
    operation: OpenApiOperationSpec,
    req: Request,
  ):
    | { ok: true }
    | { ok: false; issues: unknown; source: 'query' | 'params' | 'body' } {
    const query = this.runtime.validator?.validateQuery(operation, req.query);
    if (query && !query.ok) {
      return { ok: false, issues: query.issues, source: 'query' };
    }

    const params = this.runtime.validator?.validateParams(
      operation,
      req.params,
    );
    if (params && !params.ok) {
      return { ok: false, issues: params.issues, source: 'params' };
    }

    const body = this.runtime.validator?.validateBody(operation, req.body);
    if (body && !body.ok) {
      return { ok: false, issues: body.issues, source: 'body' };
    }

    return { ok: true };
  }
}
