import { createHash } from 'crypto';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export const sortKeysDeep = (value: JsonValue): JsonValue => {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, JsonValue>>((acc, key) => {
        acc[key] = sortKeysDeep(value[key]);
        return acc;
      }, {});
  }

  return value;
};

export const deterministicStringify = (value: JsonValue): string =>
  JSON.stringify(sortKeysDeep(value));

export const computeCatalogHash = (catalog: JsonValue): string => {
  const hash = createHash('sha256');
  hash.update(deterministicStringify(sortKeysDeep(catalog)));
  return hash.digest('hex');
};
