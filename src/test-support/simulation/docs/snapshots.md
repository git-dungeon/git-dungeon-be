# 시뮬레이션 스냅샷 테스트 가이드

## 목적
- 고정 시드 fixture 실행 결과가 회귀하지 않았는지 자동으로 검증합니다.
- delta.progress, extra.details.cause, ACQUIRE_ITEM 로그 등 핵심 필드가 포함되어 있는지 함께 확인합니다.

## 실행/업데이트
```bash
pnpm test -- --runInBand --testNamePattern "simulation fixtures"
# 결과가 바뀌어 스냅샷이 실패하면 업데이트
pnpm test -- --runInBand --testNamePattern "simulation fixtures" --update
```

## 마스킹/정규화
- `src/test-support/snapshot/normalizers.ts`에서 로그 delta/extra의 Date 값을 `<DATE>`로, summary.durationMs를 0으로 정규화합니다. 비결정 값이 스냅샷에 남지 않도록 꼭 유지하세요.

## CLI 결과 재사용
- `scripts/simulate.ts`와 동일한 `SimulationRunner`를 테스트에서 직접 호출합니다.
- JSON 리포트가 필요하면 `pnpm sim:fixtures:gen`으로 `src/test-support/simulation/generated/*.json`을 생성해 수동 비교/디버깅에 활용할 수 있습니다.

## 체크 항목
- progress/HP/EXP 변화: 각 step 로그 delta.detail.progress 또는 stats가 존재해야 합니다(MOVE 제외).
- 드랍 로그: baseline에서 ACQUIRE_ITEM 로그가 포함돼야 합니다.
- 실패 원인: turn-limit는 `extra.details.cause === TURN_LIMIT`, trap-death는 `TRAP_DAMAGE` 이어야 합니다.
