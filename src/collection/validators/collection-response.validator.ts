import type { CollectionResponse } from '../dto/collection-response.dto';
import {
  assertArray,
  assertNumber,
  assertRecord,
  assertString,
} from '../../common/validation/runtime-validation';

const assertProgress = (value: unknown, path: string): void => {
  const progress = assertRecord(value, path);
  assertNumber(progress.discovered, `${path}.discovered`, {
    integer: true,
    min: 0,
  });
  assertNumber(progress.total, `${path}.total`, {
    integer: true,
    min: 0,
  });
  assertNumber(progress.percent, `${path}.percent`, {
    integer: true,
    min: 0,
    max: 100,
  });
};

const assertCodeList = (value: unknown, path: string): void => {
  const section = assertRecord(value, path);
  const codes = assertArray(section.discoveredCodes, `${path}.discoveredCodes`);
  codes.forEach((code, index) => {
    assertString(code, `${path}.discoveredCodes[${index}]`, { minLength: 1 });
  });
};

export const assertCollectionResponse = (
  input: CollectionResponse,
): CollectionResponse => {
  const root = assertRecord(input, '$');

  const summary = assertRecord(root.summary, '$.summary');
  assertProgress(summary.items, '$.summary.items');
  assertProgress(summary.monsters, '$.summary.monsters');
  assertProgress(summary.overall, '$.summary.overall');

  assertCodeList(root.items, '$.items');
  assertCodeList(root.monsters, '$.monsters');

  return input;
};
