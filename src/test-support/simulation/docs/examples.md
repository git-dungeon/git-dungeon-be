# 던전 시뮬레이션 CLI 실행 예제

## 기본 성공 시나리오 (baseline)
```bash
pnpm sim -- --user 00000000-0000-4000-8000-000000000101 --seed baseline --max-actions 3 --fixture baseline
```
- 결과: fixture baseline PASS, final v4 / ap 2 / progress 40

## 턴 제한 패배 시나리오 (turn-limit)
```bash
pnpm sim -- --user 00000000-0000-4000-8000-000000000104 --seed tlprod1 --max-actions 1 --fixture turn-limit
```
- 결과: fixture turn-limit PASS, TURN_LIMIT 패배, final v2 / ap 0 / progress 20

## 노드랍 시나리오 (no-drop)
```bash
pnpm sim -- --user 00000000-0000-4000-8000-000000000102 --seed no-drop --max-actions 1 --fixture no-drop
```
- 결과: fixture no-drop PASS, 드랍 없음, final v2 / ap 0 / progress 0
