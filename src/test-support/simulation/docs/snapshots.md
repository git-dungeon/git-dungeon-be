# 시뮬레이션 스냅샷 테스트 가이드

## 목적

- 고정 시드 fixture 실행 결과가 회귀하지 않았는지 자동으로 검증합니다.
- delta.progress, extra.details.cause, ACQUIRE_ITEM 로그 등 핵심 필드가 포함되어 있는지 함께 확인합니다.

## 스냅샷 기준 (Snapshot Phase)

| Phase  | 설명                               | 용도             |
| ------ | ---------------------------------- | ---------------- |
| `pre`  | 실행 전 입력(초기 상태/seed) 기준  | 입력 데이터 검증 |
| `post` | 실행 결과(steps/logs/summary) 기준 | 출력 결과 검증   |

## Fixture 목록

| Fixture      | Phase | 설명                                           | 태그                   |
| ------------ | ----- | ---------------------------------------------- | ---------------------- |
| baseline     | post  | REST → REST → BATTLE 승리, 진행도 0→40         | basic                  |
| trap-death   | post  | TRAP 피해로 사망 → DEATH + REVIVE              | death, trap            |
| forced-move  | post  | progress 100 → floor 이동                      | move, floor            |
| no-drop      | post  | BATTLE 패배 → DEATH + REVIVE                   | death, battle          |
| long-battle  | post  | 6턴 전투 승리, 드랍 없음(골드만)               | battle                 |
| turn-limit   | post  | 30턴 후 TURN_LIMIT 패배                        | battle, defeat         |
| elite-battle | post  | Elite 전투 승리, 멀티 드랍                     | battle, elite, drop    |
| rest-clamp   | post  | hp full 상태에서 REST, hp 변화 0               | rest                   |
| level-up     | post  | 연속 레벨업(2회) + 골드 보상                   | battle, level-up       |

## 실행/업데이트

### npm 스크립트 (권장)

```bash
# 스냅샷 테스트 실행
pnpm snapshot:test

# 스냅샷 업데이트 (결과 변경 시)
pnpm snapshot:update

# 상세 결과 확인
pnpm snapshot:check
```

### 직접 실행

```bash
pnpm test -- --no-threads --testNamePattern "simulation fixtures"
# 결과가 바뀌어 스냅샷이 실패하면 업데이트
pnpm test -- --no-threads --testNamePattern "simulation fixtures" --update
```

## 마스킹/정규화

- `src/test-support/snapshot/normalizers.ts`에서 로그 delta/extra의 Date 값을 `<DATE>`로, summary.durationMs를 0으로 정규화합니다. 비결정 값이 스냅샷에 남지 않도록 꼭 유지하세요.

## CLI 결과 재사용

- `scripts/simulate.ts`와 동일한 `SimulationRunner`를 테스트에서 직접 호출합니다.
- JSON 리포트가 필요하면 `pnpm sim:fixtures:gen`으로 `src/test-support/simulation/generated/*.json`을 생성해 수동 비교/디버깅에 활용할 수 있습니다.

## 체크 항목

- progress/HP/EXP 변화: 각 step 로그 delta.detail.progress 또는 stats가 존재해야 합니다(MOVE 제외).
- 드랍 로그: drop 태그가 있는 fixture는 ACQUIRE_ITEM 로그가 포함돼야 합니다.
- 실패 원인: turn-limit는 `extra.details.cause === TURN_LIMIT`, trap-death는 `TRAP_DAMAGE` 이어야 합니다.

## 메타데이터 활용

각 fixture의 메타데이터는 `FixtureRegistry`를 통해 조회할 수 있습니다:

```typescript
import { FixtureRegistry } from '../test-support/dungeon/fixtures/registry';

// 특정 fixture 조회
const fixture = FixtureRegistry.get('baseline');
console.log(fixture?.meta.snapshotPhase); // 'post'
console.log(fixture?.meta.description); // '기본 시나리오...'
console.log(fixture?.meta.tags); // ['basic']

// 모든 fixture 목록
const names = FixtureRegistry.list();

// 특정 phase의 fixture만 조회
const postFixtures = FixtureRegistry.getByPhase('post');
```
