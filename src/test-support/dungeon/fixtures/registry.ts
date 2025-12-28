import type {
  FixtureDefinition,
  SnapshotPhase,
  LegacySnapshot,
} from './fixture.types';

/**
 * Fixture Registry
 * 모든 fixture를 중앙 관리하고 조회 기능 제공
 */
class FixtureRegistryImpl {
  private fixtures = new Map<string, FixtureDefinition>();

  /**
   * fixture 등록
   */
  register(fixture: FixtureDefinition): void {
    if (this.fixtures.has(fixture.meta.name)) {
      throw new Error(`Fixture "${fixture.meta.name}" is already registered`);
    }
    this.fixtures.set(fixture.meta.name, fixture);
  }

  /**
   * 이름으로 fixture 조회
   */
  get(name: string): FixtureDefinition | undefined {
    return this.fixtures.get(name);
  }

  /**
   * 등록된 fixture 이름 목록 (정렬)
   */
  list(): string[] {
    return Array.from(this.fixtures.keys()).sort((a, b) => a.localeCompare(b));
  }

  /**
   * 모든 fixture 정의 반환 (정렬)
   */
  listAll(): FixtureDefinition[] {
    return Array.from(this.fixtures.values()).sort((a, b) =>
      a.meta.name.localeCompare(b.meta.name),
    );
  }

  /**
   * 특정 phase의 fixture 목록
   */
  getByPhase(phase: SnapshotPhase): FixtureDefinition[] {
    return Array.from(this.fixtures.values()).filter(
      (f) => f.meta.snapshotPhase === phase,
    );
  }

  /**
   * 레거시 스냅샷 형식으로 변환 (하위 호환)
   */
  toLegacySnapshot(name: string): LegacySnapshot | undefined {
    const fixture = this.get(name);
    if (!fixture) return undefined;
    return {
      seed: fixture.seed,
      initialState: fixture.initialState,
      results: fixture.steps,
    };
  }

  /**
   * 모든 fixture를 레거시 형식의 맵으로 반환
   */
  getAllAsLegacy(): Record<string, LegacySnapshot> {
    const result: Record<string, LegacySnapshot> = {};
    for (const [name, fixture] of this.fixtures) {
      result[name] = {
        seed: fixture.seed,
        initialState: fixture.initialState,
        results: fixture.steps,
      };
    }
    return result;
  }

  /**
   * 테스트용: 레지스트리 초기화
   */
  clear(): void {
    this.fixtures.clear();
  }
}

export const FixtureRegistry = new FixtureRegistryImpl();
