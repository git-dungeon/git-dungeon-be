export const LOG_CATEGORY_VALUES = ['EXPLORATION', 'STATUS'] as const;
export const LOG_ACTION_VALUES = [
  'BATTLE',
  'DEATH',
  'REVIVE',
  'MOVE',
  'REST',
  'TRAP',
  'TREASURE',
  'ACQUIRE_ITEM',
  'EQUIP_ITEM',
  'UNEQUIP_ITEM',
  'DISCARD_ITEM',
  'BUFF_APPLIED',
  'BUFF_EXPIRED',
  'LEVEL_UP',
] as const;
export const LOG_STATUS_VALUES = ['STARTED', 'COMPLETED'] as const;

export type LogCategory = (typeof LOG_CATEGORY_VALUES)[number];
export type LogAction = (typeof LOG_ACTION_VALUES)[number];
export type LogStatus = (typeof LOG_STATUS_VALUES)[number];
export const LOG_TYPE_VALUES = [
  ...LOG_CATEGORY_VALUES,
  ...LOG_ACTION_VALUES,
] as const;
export type LogTypeFilter = (typeof LOG_TYPE_VALUES)[number];

// Swagger UI에서 enum으로 표현하기 위한 명시적 enum 타입
export enum LogTypeEnum {
  BATTLE = 'BATTLE',
  DEATH = 'DEATH',
  REVIVE = 'REVIVE',
  MOVE = 'MOVE',
  REST = 'REST',
  TRAP = 'TRAP',
  TREASURE = 'TREASURE',
  ACQUIRE_ITEM = 'ACQUIRE_ITEM',
  EQUIP_ITEM = 'EQUIP_ITEM',
  UNEQUIP_ITEM = 'UNEQUIP_ITEM',
  DISCARD_ITEM = 'DISCARD_ITEM',
  BUFF_APPLIED = 'BUFF_APPLIED',
  BUFF_EXPIRED = 'BUFF_EXPIRED',
  LEVEL_UP = 'LEVEL_UP',
  EXPLORATION = 'EXPLORATION',
  STATUS = 'STATUS',
}

export const isLogCategory = (value: string): value is LogCategory =>
  LOG_CATEGORY_VALUES.includes(value as LogCategory);

export const isLogAction = (value: string): value is LogAction =>
  LOG_ACTION_VALUES.includes(value as LogAction);
