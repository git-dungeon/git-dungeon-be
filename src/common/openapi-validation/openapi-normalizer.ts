const NULLABLE_KEY = 'nullable';

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const normalizeSchemaNode = (
  value: unknown,
  visited: WeakSet<object>,
): unknown => {
  if (!isPlainObject(value)) {
    if (Array.isArray(value)) {
      return value.map((item) => normalizeSchemaNode(item, visited));
    }
    return value;
  }

  if (visited.has(value)) {
    return value;
  }
  visited.add(value);

  const next: Record<string, unknown> = {};
  for (const [key, node] of Object.entries(value)) {
    if (key === NULLABLE_KEY) {
      continue;
    }
    next[key] = normalizeSchemaNode(node, visited);
  }

  const nullable = value[NULLABLE_KEY];
  if (nullable === true) {
    // OpenAPI 3.1 should express nullability via JSON Schema, but this spec still uses `nullable`.
    // We normalize it for Ajv by wrapping the schema with `anyOf: [<schema>, { type: "null" }]`.
    return {
      anyOf: [next, { type: 'null' }],
    };
  }

  return next;
};

export const normalizeOpenApiDocumentForAjv = <T>(document: T): T => {
  const visited = new WeakSet<object>();
  return normalizeSchemaNode(document, visited) as T;
};
