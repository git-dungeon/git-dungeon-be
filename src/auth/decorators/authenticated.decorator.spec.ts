import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { AuthGuard } from '../guards/auth.guard';
import { Authenticated } from './authenticated.decorator';

describe('Authenticated decorator', () => {
  it('메서드에 AuthGuard 메타데이터를 부여해야 한다', () => {
    const decorator = Authenticated();
    const target = {};
    const descriptor = {
      value: () => undefined,
      configurable: true,
      enumerable: false,
      writable: true,
    } satisfies PropertyDescriptor;

    decorator(target, 'method', descriptor);

    const metadata = Reflect.getMetadata('__guards__', descriptor.value) as
      | unknown[]
      | undefined;

    expect(metadata).toBeDefined();
    expect(metadata).toContain(AuthGuard);
  });
});
