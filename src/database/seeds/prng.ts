/** mulberry32 — a tiny deterministic 32-bit PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Convenience helpers over a deterministic float source. */
export class Random {
  constructor(private readonly nextFloat: () => number) {}

  float(): number {
    return this.nextFloat();
  }

  /** Integer in `[min, max]` (inclusive). */
  int(min: number, max: number): number {
    return min + Math.floor(this.nextFloat() * (max - min + 1));
  }

  chance(probability: number): boolean {
    return this.nextFloat() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('pick() from an empty list');
    return items[Math.floor(this.nextFloat() * items.length)]!;
  }

  /** Picks a value with probability proportional to its weight. */
  weighted<T>(entries: ReadonlyArray<readonly [T, number]>): T {
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = this.nextFloat() * total;
    for (const [value, weight] of entries) {
      roll -= weight;
      if (roll < 0) return value;
    }
    return entries[entries.length - 1]![0];
  }

  /** `count` distinct items, in random order. */
  sample<T>(items: readonly T[], count: number): T[] {
    const pool = [...items];
    const result: T[] = [];
    while (result.length < count && pool.length > 0) {
      result.push(pool.splice(Math.floor(this.nextFloat() * pool.length), 1)[0]!);
    }
    return result;
  }

  /** A version-4-shaped UUID built from PRNG bytes (deterministic, unlike crypto). */
  uuid(): string {
    const bytes = Array.from({ length: 16 }, () => Math.floor(this.nextFloat() * 256));
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
}
