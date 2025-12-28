import {
  extractFlatStatModifiers,
  calculateStatsDiff,
  isEmptyStatsDelta,
} from './stat-delta.util';
import type { InventoryModifier } from '../inventory/inventory-modifier';

describe('stat-delta.util', () => {
  describe('extractFlatStatModifiers', () => {
    it('flat stat modifiers를 추출한다', () => {
      const modifiers: InventoryModifier[] = [
        { kind: 'stat', stat: 'atk', mode: 'flat', value: 5 },
        { kind: 'stat', stat: 'def', mode: 'flat', value: 3 },
      ];

      const result = extractFlatStatModifiers(modifiers);

      expect(result).toEqual({ atk: 5, def: 3 });
    });

    it('percent mode는 무시한다', () => {
      const modifiers: InventoryModifier[] = [
        { kind: 'stat', stat: 'atk', mode: 'flat', value: 5 },
        { kind: 'stat', stat: 'luck', mode: 'percent', value: 10 },
      ];

      const result = extractFlatStatModifiers(modifiers);

      expect(result).toEqual({ atk: 5 });
    });

    it('effect modifier는 무시한다', () => {
      const modifiers: InventoryModifier[] = [
        { kind: 'stat', stat: 'atk', mode: 'flat', value: 5 },
        { kind: 'effect', effectCode: 'bleed-1' },
      ];

      const result = extractFlatStatModifiers(modifiers);

      expect(result).toEqual({ atk: 5 });
    });

    it('같은 스탯은 합산한다', () => {
      const modifiers: InventoryModifier[] = [
        { kind: 'stat', stat: 'atk', mode: 'flat', value: 5 },
        { kind: 'stat', stat: 'atk', mode: 'flat', value: 3 },
      ];

      const result = extractFlatStatModifiers(modifiers);

      expect(result).toEqual({ atk: 8 });
    });

    it('빈 modifiers는 빈 객체를 반환한다', () => {
      const result = extractFlatStatModifiers([]);

      expect(result).toEqual({});
    });
  });

  describe('calculateStatsDiff', () => {
    it('장착 스탯 - 해제 스탯 = 순 변화량', () => {
      const equipStats = { atk: 10, def: 5 };
      const unequipStats = { atk: 3, def: 2 };

      const result = calculateStatsDiff(equipStats, unequipStats);

      expect(result).toEqual({ atk: 7, def: 3 });
    });

    it('음수 결과도 포함한다', () => {
      const equipStats = { atk: 2 };
      const unequipStats = { atk: 5 };

      const result = calculateStatsDiff(equipStats, unequipStats);

      expect(result).toEqual({ atk: -3 });
    });

    it('0인 차이는 제외한다', () => {
      const equipStats = { atk: 5, def: 3 };
      const unequipStats = { atk: 5 };

      const result = calculateStatsDiff(equipStats, unequipStats);

      expect(result).toEqual({ def: 3 });
    });

    it('해제만 있으면 음수', () => {
      const equipStats = {};
      const unequipStats = { atk: 5 };

      const result = calculateStatsDiff(equipStats, unequipStats);

      expect(result).toEqual({ atk: -5 });
    });
  });

  describe('isEmptyStatsDelta', () => {
    it('빈 객체면 true', () => {
      expect(isEmptyStatsDelta({})).toBe(true);
    });

    it('값이 있으면 false', () => {
      expect(isEmptyStatsDelta({ atk: 5 })).toBe(false);
    });
  });
});
