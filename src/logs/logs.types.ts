export const LOG_CATEGORY_VALUES = ['EXPLORATION', 'STATUS'] as const;
export const LOG_ACTION_VALUES = [
  'BATTLE',
  'DEATH',
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
export type LogTypeFilter = LogCategory | LogAction;

export const isLogCategory = (value: string): value is LogCategory =>
  LOG_CATEGORY_VALUES.includes(value as LogCategory);

export const isLogAction = (value: string): value is LogAction =>
  LOG_ACTION_VALUES.includes(value as LogAction);
