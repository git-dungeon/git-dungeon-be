import type { ActiveSessionResult } from '../auth/auth-session.service';
import type { DashboardStateResponse } from '../dashboard/dto/dashboard-state.response';

export const createActiveSession = (
  overrides: Partial<ActiveSessionResult> = {},
): ActiveSessionResult => ({
  payload: {
    session: { userId: 'user-1' },
    user: { id: 'user-1' },
  },
  cookies: ['better-auth.session_token=stub; Path=/; HttpOnly'],
  refreshed: false,
  view: {
    session: {
      userId: 'user-1',
      username: 'mock-user',
      displayName: 'Mock User',
      email: 'mock@example.com',
      avatarUrl: 'https://example.com/avatar.png',
    },
    refreshed: false,
  },
  ...overrides,
});

export const createDashboardStateResponse = (
  overrides: Partial<DashboardStateResponse['state']> = {},
): DashboardStateResponse => ({
  state: {
    userId: 'user-1',
    level: 5,
    exp: 120,
    hp: 100,
    maxHp: 120,
    atk: 25,
    def: 10,
    luck: 7,
    floor: 3,
    maxFloor: 10,
    floorProgress: 0.5,
    gold: 500,
    ap: 8,
    currentAction: 'idle',
    currentActionStartedAt: '2025-10-27T07:00:00.000Z',
    createdAt: '2025-10-27T06:00:00.000Z',
    updatedAt: '2025-10-27T07:00:00.000Z',
    expToLevel: 50,
    equippedItems: [
      {
        id: 'item-1',
        code: 'SWORD_1',
        name: null,
        slot: 'weapon',
        rarity: 'common',
        modifiers: [],
        effect: null,
        sprite: null,
        createdAt: '2025-10-26T12:00:00.000Z',
        isEquipped: true,
        version: 1,
      },
    ],
    version: 1,
    ...overrides,
  },
});
