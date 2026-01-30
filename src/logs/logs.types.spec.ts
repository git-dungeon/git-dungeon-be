import { describe, expect, it } from 'vitest';
import { DungeonLogAction } from '@prisma/client';
import { LOG_ACTION_VALUES, LogTypeEnum, isLogAction } from './logs.types';

describe('logs.types', () => {
  it('LOG_ACTION_VALUES는 DungeonLogAction과 동기화되어야 한다', () => {
    const prismaActions = Object.values(DungeonLogAction);
    const missing = prismaActions.filter(
      (action) =>
        !LOG_ACTION_VALUES.includes(
          action as (typeof LOG_ACTION_VALUES)[number],
        ),
    );
    const extra = LOG_ACTION_VALUES.filter(
      (action) => !prismaActions.includes(action as DungeonLogAction),
    );

    expect(missing).toEqual([]);
    expect(extra).toEqual([]);
  });

  it('isLogAction은 모든 DungeonLogAction 값을 허용해야 한다', () => {
    for (const action of Object.values(DungeonLogAction)) {
      expect(isLogAction(action)).toBe(true);
    }
  });

  it('LogTypeEnum은 모든 DungeonLogAction 값을 포함해야 한다', () => {
    const logTypeValues = Object.values(LogTypeEnum);
    for (const action of Object.values(DungeonLogAction)) {
      expect(logTypeValues).toContain(action);
    }
  });
});
