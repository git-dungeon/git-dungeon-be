import type { DungeonState } from '@prisma/client';
import type { StatsDelta } from '../../../common/logs/dungeon-log-delta';
import type { DungeonLogDetails } from '../../../common/logs/dungeon-log-extra';
import type { CatalogMonster } from '../../../catalog';
import {
  DungeonEventProcessor,
  DungeonEventProcessorInput,
  DungeonEventProcessorOutput,
  DungeonEventType,
} from '../event.types';
import { BATTLE_PROGRESS_INCREMENT } from '../event.types';
import {
  MonsterRegistry,
  getScaledStats,
  type MonsterScalingOptions,
} from '../../monsters';
import type { DropService } from '../../drops/drop.service';
import { DEFAULT_DROP_TABLE_ID } from '../../drops/drop.service';
import { rollDrops } from '../../drops/drop.utils';

type BattleOutcome = 'VICTORY' | 'DEFEAT';

type DeterministicRng = () => number;

type RngFactory = (seed: number) => DeterministicRng;

type BattleEngineOptions = {
  eliteRate?: number;
  turnLimit?: number;
  rngFactory?: RngFactory;
  scalingOptions?: MonsterScalingOptions;
  critBase?: number;
  critLuckFactor?: number;
  eliteExpBonus?: number;
  dropService?: DropService;
  defaultDropTableId?: string;
};

const DEFAULT_ELITE_RATE = 0.05; // 5%
const DEFAULT_CRIT_BASE = 0.05;
const DEFAULT_CRIT_LUCK_FACTOR = 0.01;
const DEFAULT_TURN_LIMIT = 30;

const clamp01 = (value: number, max = 1): number =>
  Math.min(Math.max(value, 0), max);

const createDeterministicRng: RngFactory = (seed: number): DeterministicRng => {
  // mulberry32 변형으로 간단한 결정적 RNG를 만든다.
  let t = Math.floor(seed * 1e9) >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

const pickMonster = (
  registry: MonsterRegistry,
  rng: DeterministicRng,
  eliteRate: number,
  floor: number,
): CatalogMonster => {
  const all = registry.list();
  const elites = all.filter((m) => m.rarity === 'elite');
  const normals = all.filter((m) => m.rarity === 'normal');
  const useElite = elites.length > 0 && rng() < eliteRate;
  const poolBase = useElite && elites.length > 0 ? elites : normals;
  if (poolBase.length === 0) {
    throw new Error('몬스터 목록이 비어 있습니다.');
  }
  const sorted = [...poolBase].sort((a, b) => a.hp - b.hp);
  const fraction = Math.min(1, Math.max(0.1, floor * 0.05));
  const poolSize = Math.max(1, Math.round(sorted.length * fraction));
  const pool = sorted.slice(0, poolSize);
  const index = Math.floor(rng() * pool.length);
  return pool[index];
};

const computeExpReward = (
  monster: CatalogMonster,
  scaled: ReturnType<typeof getScaledStats>,
  eliteBonus: number,
): number => {
  const base = (scaled.hp + scaled.atk + scaled.def) / 3;
  const rarityBonus = monster.rarity === 'elite' ? eliteBonus : 1;
  return Math.max(1, Math.round(base * rarityBonus));
};

const computeDamage = (
  attackerAtk: number,
  defenderDef: number,
  luck: number,
  rng: DeterministicRng,
  options: { critBase: number; critLuckFactor: number },
): { damage: number; crit: boolean } => {
  const base = Math.max(1, attackerAtk - defenderDef);
  const critChance = clamp01(
    options.critBase + luck * options.critLuckFactor,
    0.5,
  );
  const crit = rng() < critChance;
  const variance = 0.1; // ±10% 변동
  const varianceFactor = 1 + (rng() * 2 - 1) * variance;
  const scaled = base * varianceFactor * (crit ? 2 : 1);
  return {
    damage: Math.max(1, Math.round(scaled)),
    crit,
  };
};

export class BattleEventProcessor implements DungeonEventProcessor {
  readonly type = DungeonEventType.BATTLE;

  constructor(
    private readonly registry: MonsterRegistry,
    private readonly options: BattleEngineOptions = {},
  ) {}

  process(input: DungeonEventProcessorInput): DungeonEventProcessorOutput {
    const rngFactory = this.options.rngFactory ?? createDeterministicRng;
    const rng = rngFactory(input.rngValue);
    const eliteRate = this.options.eliteRate ?? DEFAULT_ELITE_RATE;
    const critBase = this.options.critBase ?? DEFAULT_CRIT_BASE;
    const critLuckFactor =
      this.options.critLuckFactor ?? DEFAULT_CRIT_LUCK_FACTOR;
    const eliteExpBonus = this.options.eliteExpBonus ?? 1.5;
    const monsterMeta = pickMonster(
      this.registry,
      rng,
      eliteRate,
      input.state.floor,
    );
    const scaled = getScaledStats(
      monsterMeta,
      input.state.floor,
      this.options.scalingOptions,
    );

    let playerHp = input.state.hp;
    let monsterHp = scaled.hp;
    let outcome: BattleOutcome = 'VICTORY';
    let cause: string | undefined;
    let turn = 0;
    let damageDealt = 0;
    let damageTaken = 0;

    const turnLimit = this.options.turnLimit ?? DEFAULT_TURN_LIMIT;

    while (playerHp > 0 && monsterHp > 0 && turn < turnLimit) {
      turn += 1;

      const playerHit = computeDamage(
        input.state.atk,
        scaled.def,
        input.state.luck,
        rng,
        { critBase, critLuckFactor },
      );
      monsterHp -= playerHit.damage;
      damageDealt += playerHit.damage;

      if (monsterHp <= 0) {
        outcome = 'VICTORY';
        cause = playerHit.crit ? 'CRITICAL_HIT' : undefined;
        break;
      }

      const monsterHit = computeDamage(
        scaled.atk,
        input.state.def,
        0, // 몬스터 luck은 현재 모델링하지 않음
        rng,
        { critBase, critLuckFactor },
      );
      playerHp -= monsterHit.damage;
      damageTaken += monsterHit.damage;

      if (playerHp <= 0) {
        outcome = 'DEFEAT';
        cause = 'PLAYER_DEFEATED';
        break;
      }
    }

    if (turn >= turnLimit && monsterHp > 0 && playerHp > 0) {
      outcome = 'DEFEAT';
      cause = 'TURN_LIMIT';
    }

    const expGained =
      outcome === 'VICTORY'
        ? computeExpReward(monsterMeta, scaled, eliteExpBonus)
        : 0;

    const drops =
      outcome === 'VICTORY' ? this.rollDrops(monsterMeta, { next: rng }) : [];

    return this.buildResult({
      input,
      outcome,
      monsterMeta,
      scaled,
      playerHp: Math.max(0, playerHp),
      cause,
      expGained,
      turns: turn,
      damageDealt,
      damageTaken,
      drops,
    });
  }

  private buildResult(params: {
    input: DungeonEventProcessorInput;
    outcome: BattleOutcome;
    monsterMeta: CatalogMonster;
    scaled: ReturnType<typeof getScaledStats>;
    playerHp: number;
    expGained: number;
    cause?: string;
    turns?: number;
    damageDealt?: number;
    damageTaken?: number;
    drops?: ReturnType<DropService['roll']>;
  }): DungeonEventProcessorOutput {
    const {
      input,
      outcome,
      monsterMeta,
      scaled,
      playerHp,
      cause,
      expGained,
      turns,
      damageDealt,
      damageTaken,
    } = params;

    const nextState = this.buildNextState(input.state, outcome, playerHp);
    const statsDelta: StatsDelta = {};
    if (nextState.hp !== input.state.hp) {
      statsDelta.hp = nextState.hp - input.state.hp;
    }

    const dropMeta: DungeonEventProcessorOutput['dropMeta'] =
      params.drops && params.drops.length > 0
        ? {
            tableId:
              params.monsterMeta.dropTableId ??
              this.options.defaultDropTableId ??
              DEFAULT_DROP_TABLE_ID,
            isElite: params.monsterMeta.rarity === 'elite',
            items: params.drops.map((drop) => ({
              itemCode: drop.itemCode,
              quantity: drop.quantity,
            })),
          }
        : undefined;

    return {
      state: nextState,
      delta: {
        type: 'BATTLE',
        detail: {
          stats: Object.keys(statsDelta).length ? statsDelta : undefined,
          rewards: {
            items:
              dropMeta?.items?.map((item) => ({
                itemCode: item.itemCode,
                quantity: item.quantity,
              })) ?? [],
          },
          progress:
            outcome === 'DEFEAT'
              ? {
                  previousProgress: input.state.floorProgress,
                  floorProgress: Math.max(
                    0,
                    input.state.floorProgress - BATTLE_PROGRESS_INCREMENT,
                  ),
                  delta: -Math.min(
                    input.state.floorProgress,
                    BATTLE_PROGRESS_INCREMENT,
                  ),
                }
              : undefined,
        },
      },
      extra: this.buildBattleDetails(
        monsterMeta,
        scaled,
        outcome === 'VICTORY' ? 'VICTORY' : 'DEFEAT',
        {
          cause,
          expGained,
          turns,
          damageDealt,
          damageTaken,
        },
      ),
      expGained,
      drops: params.drops?.length ? params.drops : undefined,
      dropMeta,
    };
  }

  private buildNextState(
    state: DungeonState,
    outcome: BattleOutcome,
    playerHp: number,
  ): DungeonState {
    const defeatedProgress =
      outcome === 'DEFEAT'
        ? Math.max(0, state.floorProgress - BATTLE_PROGRESS_INCREMENT)
        : state.floorProgress;

    return {
      ...state,
      hp: Math.max(0, Math.min(playerHp, state.maxHp)),
      floorProgress: defeatedProgress,
    };
  }

  private rollDrops(
    monster: CatalogMonster,
    rng: { next: () => number },
  ): ReturnType<DropService['roll']> {
    return rollDrops({
      dropService: this.options.dropService,
      tableId:
        monster.dropTableId ??
        this.options.defaultDropTableId ??
        DEFAULT_DROP_TABLE_ID,
      rng,
      isElite: monster.rarity === 'elite',
    });
  }

  private buildBattleDetails(
    monster: CatalogMonster,
    scaled: ReturnType<typeof getScaledStats>,
    result: 'VICTORY' | 'DEFEAT',
    options: {
      cause?: string;
      expGained?: number;
      turns?: number;
      damageDealt?: number;
      damageTaken?: number;
    },
  ): DungeonLogDetails {
    return {
      type: 'BATTLE',
      details: {
        monster: {
          id: monster.id,
          name: monster.name,
          hp: scaled.hp,
          atk: scaled.atk,
          def: scaled.def,
          spriteId: monster.spriteId,
        },
        result,
        cause: options.cause,
        expGained: options.expGained,
        turns: options.turns,
        damageDealt: options.damageDealt,
        damageTaken: options.damageTaken,
      },
    };
  }
}
