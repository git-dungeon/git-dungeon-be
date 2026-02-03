import type { ActiveSessionResult } from '../auth/auth-session.service';
import type { DashboardStateResponse } from '../dashboard/dto/dashboard-state.response';
import type { InventoryResponse } from '../inventory/dto/inventory.response';

export const TEST_USER_ID_1 = '00000000-0000-4000-8000-000000000001';
export const TEST_USER_ID_2 = '00000000-0000-4000-8000-000000000002';

export const TEST_INVENTORY_ITEM_ID_1 = '11111111-1111-4111-8111-111111111111';

export const createActiveSession = (
  overrides: Partial<ActiveSessionResult> = {},
): ActiveSessionResult => ({
  payload: {
    session: { userId: TEST_USER_ID_1 },
    user: { id: TEST_USER_ID_1 },
  },
  cookies: ['better-auth.session_token=stub; Path=/; HttpOnly'],
  refreshed: false,
  view: {
    session: {
      userId: TEST_USER_ID_1,
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
    userId: TEST_USER_ID_1,
    level: 5,
    exp: 120,
    levelUpPoints: 0,
    unopenedChests: 0,
    hp: 100,
    maxHp: 120,
    atk: 25,
    def: 10,
    luck: 7,
    floor: 3,
    maxFloor: 10,
    floorProgress: 50,
    gold: 500,
    ap: 8,
    currentAction: 'idle',
    currentActionStartedAt: '2025-10-27T07:00:00.000Z',
    createdAt: '2025-10-27T06:00:00.000Z',
    updatedAt: '2025-10-27T07:00:00.000Z',
    expToLevel: 50,
    stats: {
      base: { hp: 120, maxHp: 120, atk: 25, def: 10, luck: 7 },
      equipmentBonus: { hp: 0, maxHp: 0, atk: 0, def: 0, luck: 0 },
      total: { hp: 120, maxHp: 120, atk: 25, def: 10, luck: 7 },
    },
    equippedItems: [
      {
        id: TEST_INVENTORY_ITEM_ID_1,
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

export const createInventoryResponse = (
  overrides: Partial<InventoryResponse> = {},
): InventoryResponse => ({
  version: 3,
  items: [
    {
      id: TEST_INVENTORY_ITEM_ID_1,
      code: 'weapon-longsword',
      name: null,
      slot: 'weapon',
      rarity: 'rare',
      modifiers: [
        { kind: 'stat', stat: 'atk', mode: 'flat', value: 5 },
        { kind: 'stat', stat: 'def', mode: 'percent', value: 0.5 },
      ],
      effect: null,
      sprite: null,
      createdAt: '2025-10-30T09:00:00.000Z',
      isEquipped: true,
      quantity: 1,
      enhancementLevel: 0,
      version: 3,
    },
  ],
  equipped: {
    weapon: {
      id: TEST_INVENTORY_ITEM_ID_1,
      code: 'weapon-longsword',
      name: null,
      slot: 'weapon',
      rarity: 'rare',
      modifiers: [
        { kind: 'stat', stat: 'atk', mode: 'flat', value: 5 },
        { kind: 'stat', stat: 'def', mode: 'percent', value: 0.5 },
      ],
      effect: null,
      sprite: null,
      createdAt: '2025-10-30T09:00:00.000Z',
      isEquipped: true,
      quantity: 1,
      enhancementLevel: 0,
      version: 3,
    },
  },
  summary: {
    base: { hp: 10, maxHp: 10, atk: 5, def: 3, luck: 1 },
    total: { hp: 10, maxHp: 10, atk: 10, def: 5, luck: 1 },
    equipmentBonus: { hp: 0, maxHp: 0, atk: 5, def: 2, luck: 0 },
  },
  ...overrides,
});
