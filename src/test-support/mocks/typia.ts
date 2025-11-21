/// <reference types="vitest" />

export const typiaAssertMock = vi.fn((value: unknown) => value);

export class MockTypeGuardError extends Error {
  constructor(
    public readonly path?: string,
    public readonly expected?: string,
    public readonly value?: unknown,
  ) {
    super('MockTypeGuardError');
  }
}

export const typiaModuleMock = {
  __esModule: true,
  default: {
    assert: typiaAssertMock,
  },
  assert: typiaAssertMock,
  TypeGuardError: MockTypeGuardError,
} as const;

export const resetTypiaAssertMock = (): void => {
  typiaAssertMock.mockReset();
  typiaAssertMock.mockImplementation((value) => value);
};
