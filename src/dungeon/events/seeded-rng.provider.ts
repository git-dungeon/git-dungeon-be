import seedrandom, { type PRNG } from 'seedrandom';

export interface SeededRandom {
  next(): number;
}

export interface SeededRandomFactory {
  create(seed: string): SeededRandom;
}

export class SeedrandomFactory implements SeededRandomFactory {
  create(seed: string): SeededRandom {
    const rng: PRNG = seedrandom(seed);

    return {
      next: () => rng.quick(),
    };
  }
}

export const SEEDED_RNG_FACTORY = 'SEEDED_RNG_FACTORY';
