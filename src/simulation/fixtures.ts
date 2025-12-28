// fixture 모듈을 import하면 각 fixture가 자동으로 registry에 등록됨 (side-effect)
import '../test-support/dungeon/fixtures';

import { FixtureRegistry } from '../test-support/dungeon/fixtures/registry';
import type { SimulationSnapshot } from './types';

/**
 * 등록된 fixture 이름 목록 (정렬)
 */
export const listFixtureNames = (): string[] => FixtureRegistry.list();

/**
 * 이름으로 fixture 조회 (레거시 SimulationSnapshot 형식)
 */
export const getFixture = (
  name: string | undefined,
): SimulationSnapshot | undefined => {
  if (!name) return undefined;
  return FixtureRegistry.toLegacySnapshot(name);
};

/**
 * 모든 fixture를 레거시 형식의 맵으로 반환
 * @deprecated 하위 호환용. FixtureRegistry 직접 사용 권장
 */
export const fixtures: Record<string, SimulationSnapshot> =
  FixtureRegistry.getAllAsLegacy();
