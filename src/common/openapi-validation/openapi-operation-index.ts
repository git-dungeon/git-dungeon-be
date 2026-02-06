type HttpMethod =
  | 'get'
  | 'post'
  | 'put'
  | 'patch'
  | 'delete'
  | 'options'
  | 'head';

type OpenApiParameter = {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  required?: boolean;
  schema?: unknown;
  content?: unknown;
};

type OpenApiRequestBody = {
  required?: boolean;
  content?: Record<string, { schema?: unknown }>;
};

export type OpenApiOperationSpec = {
  method: HttpMethod;
  path: string;
  operationId?: string;
  tags?: string[];
  querySchema?: unknown;
  paramsSchema?: unknown;
  bodySchema?: unknown;
};

export type OperationIndex = Map<string, OpenApiOperationSpec>;

const HTTP_METHODS: Set<string> = new Set([
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'options',
  'head',
]);

const normalizePath = (value: string): string => {
  if (!value.startsWith('/')) {
    return `/${value}`;
  }
  return value;
};

export const buildOpenApiOperationIndex = (
  document: Record<string, unknown>,
): OperationIndex => {
  const index: OperationIndex = new Map();
  const paths = document.paths;
  if (!paths || typeof paths !== 'object') {
    return index;
  }

  for (const [rawPath, pathItem] of Object.entries(
    paths as Record<string, unknown>,
  )) {
    if (!pathItem || typeof pathItem !== 'object') {
      continue;
    }

    const sharedParameters = Array.isArray(
      (pathItem as { parameters?: unknown }).parameters,
    )
      ? ((pathItem as { parameters: unknown[] })
          .parameters as OpenApiParameter[])
      : [];

    for (const [rawMethod, operation] of Object.entries(
      pathItem as Record<string, unknown>,
    )) {
      const method = rawMethod.toLowerCase();
      if (!HTTP_METHODS.has(method)) {
        continue;
      }
      if (!operation || typeof operation !== 'object') {
        continue;
      }

      const op = operation as {
        operationId?: unknown;
        tags?: unknown;
        parameters?: unknown;
        requestBody?: unknown;
      };

      const opParameters = Array.isArray(op.parameters)
        ? (op.parameters as OpenApiParameter[])
        : [];
      const mergedParameters = new Map<string, OpenApiParameter>();
      const setParameter = (parameter: OpenApiParameter): void => {
        if (
          !parameter ||
          typeof parameter !== 'object' ||
          typeof parameter.in !== 'string' ||
          typeof parameter.name !== 'string'
        ) {
          return;
        }
        mergedParameters.set(`${parameter.in}:${parameter.name}`, parameter);
      };
      sharedParameters.forEach((parameter) => {
        setParameter(parameter);
      });
      opParameters.forEach((parameter) => {
        setParameter(parameter);
      });
      const parameters = [...mergedParameters.values()];

      const querySchema = buildObjectSchemaFromParameters(
        parameters.filter((p) => p.in === 'query'),
        {
          allowAdditional: true,
        },
      );

      const paramsSchema = buildObjectSchemaFromParameters(
        parameters.filter((p) => p.in === 'path'),
        {
          allowAdditional: false,
        },
      );

      const bodySchema = resolveJsonBodySchema(op.requestBody);

      const spec: OpenApiOperationSpec = {
        method: method as HttpMethod,
        path: normalizePath(rawPath),
        operationId:
          typeof op.operationId === 'string' ? op.operationId : undefined,
        tags: Array.isArray(op.tags)
          ? op.tags.filter((t) => typeof t === 'string')
          : undefined,
        querySchema,
        paramsSchema,
        bodySchema,
      };

      const key = buildIndexKey(spec.method, spec.path);
      index.set(key, spec);
    }
  }

  return index;
};

export const buildIndexKey = (method: string, path: string): string => {
  return `${method.toLowerCase()} ${normalizePath(path)}`;
};

const resolveJsonBodySchema = (requestBody: unknown): unknown => {
  if (!requestBody || typeof requestBody !== 'object') {
    return undefined;
  }

  const body = requestBody as OpenApiRequestBody;
  const schema = body.content?.['application/json']?.schema;
  return schema ?? undefined;
};

const buildObjectSchemaFromParameters = (
  params: OpenApiParameter[],
  options: { allowAdditional: boolean },
): unknown => {
  if (params.length === 0) {
    return undefined;
  }

  const properties: Record<string, unknown> = {};
  const required = new Set<string>();

  for (const param of params) {
    if (!param || typeof param !== 'object') {
      continue;
    }
    if (!param.name || typeof param.name !== 'string') {
      continue;
    }

    // We only support the common `schema` form for now.
    if (param.schema !== undefined) {
      properties[param.name] = param.schema;
    }
    if (param.required) {
      required.add(param.name);
    }
  }

  const schema: Record<string, unknown> = {
    type: 'object',
    properties,
    additionalProperties: options.allowAdditional,
  };

  if (required.size > 0) {
    schema.required = [...required];
  }

  return schema;
};
