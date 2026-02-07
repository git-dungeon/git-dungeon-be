const NULLABLE_KEY = 'nullable';

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const hasNullSchema = (entries: unknown[]): boolean => {
  return entries.some((entry) => isPlainObject(entry) && entry.type === 'null');
};

const normalizeSchemaNode = (
  value: unknown,
  cache: WeakMap<object, unknown>,
): unknown => {
  if (Array.isArray(value)) {
    if (cache.has(value)) {
      return cache.get(value);
    }

    const normalized: unknown[] = [];
    cache.set(value, normalized);
    value.forEach((item) => {
      normalized.push(normalizeSchemaNode(item, cache));
    });
    return normalized;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  if (cache.has(value)) {
    return cache.get(value);
  }

  const next: Record<string, unknown> = {};
  cache.set(value, next);

  for (const [key, node] of Object.entries(value)) {
    if (key === NULLABLE_KEY) {
      continue;
    }
    next[key] = normalizeSchemaNode(node, cache);
  }

  const nullable = value[NULLABLE_KEY];
  if (nullable === true) {
    if (Array.isArray(next.anyOf)) {
      const currentAnyOf = next.anyOf as unknown[];
      const normalizedAnyOf = hasNullSchema(currentAnyOf)
        ? currentAnyOf
        : currentAnyOf.concat({ type: 'null' });
      const normalized = {
        ...next,
        anyOf: normalizedAnyOf,
      };
      cache.set(value, normalized);
      return normalized;
    }

    if (Array.isArray(next.oneOf)) {
      const currentOneOf = next.oneOf as unknown[];
      const normalizedOneOf = hasNullSchema(currentOneOf)
        ? currentOneOf
        : currentOneOf.concat({ type: 'null' });
      const normalized = {
        ...next,
        oneOf: normalizedOneOf,
      };
      cache.set(value, normalized);
      return normalized;
    }

    // OpenAPI 3.1 should express nullability via JSON Schema, but this spec still uses `nullable`.
    // We normalize it for Ajv by wrapping the schema with `anyOf: [<schema>, { type: "null" }]`.
    const normalized = {
      anyOf: [next, { type: 'null' }],
    };
    cache.set(value, normalized);
    return normalized;
  }

  return next;
};

export const normalizeOpenApiDocumentForAjv = <T>(document: T): T => {
  const cache = new WeakMap<object, unknown>();
  return normalizeSchemaNode(document, cache) as T;
};
