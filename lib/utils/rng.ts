/**
 * Deterministic PRNG for synthetic data generation. The same seed always
 * produces the same sequence — required so every reload/build/test run
 * reconciles to identical numbers across every page (PRD §27.6).
 * Never use Math.random() in data generation (lib/dataset/demo/**).
 */
function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromString(str: string): number {
  let h = 1779033703;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

export class Rng {
  private next: () => number;
  constructor(seed: string) {
    this.next = mulberry32(seedFromString(seed));
  }
  float(): number {
    return this.next();
  }
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
  pick<T>(arr: readonly T[]): T {
    const item = arr[Math.floor(this.next() * arr.length)];
    if (item === undefined) throw new Error("Rng.pick called on empty array");
    return item;
  }
}
