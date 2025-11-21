/// <reference types="vitest" />

const wrap =
  <T extends (...params: never[]) => unknown>(decorator: T) =>
  (...params: Parameters<T>): ReturnType<T> =>
    decorator(...params) as ReturnType<T>;

export const createNestiaModuleMock = async () => {
  const decorators = await import('@nestjs/common');
  const typedExceptionMock = vi.fn(() => () => undefined);

  return {
    __esModule: true,
    TypedRoute: {
      Get: wrap(decorators.Get),
      Post: wrap(decorators.Post),
      Put: wrap(decorators.Put),
      Patch: wrap(decorators.Patch),
      Delete: wrap(decorators.Delete),
    },
    TypedBody: wrap(decorators.Body),
    TypedParam: wrap(decorators.Param),
    TypedQuery: wrap(decorators.Query),
    TypedHeaders: wrap(decorators.Headers),
    TypedException: typedExceptionMock,
  } as const;
};
