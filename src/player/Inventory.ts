// Survival-style stock of every item (blocks, tools, food, gear…): breaking
// a block adds it, placing or eating consumes it.
export class Inventory {
  private counts = new Map<number, number>();
  private listeners: (() => void)[] = [];

  count(id: number): number {
    return this.counts.get(id) ?? 0;
  }

  add(id: number, amount = 1): void {
    this.counts.set(id, this.count(id) + amount);
    this.emit();
  }

  // Returns false (and changes nothing) if there is no stock left.
  remove(id: number, amount = 1): boolean {
    const have = this.count(id);
    if (have < amount) return false;
    this.counts.set(id, have - amount);
    this.emit();
    return true;
  }

  // Top up to at least n (session starter stock)
  ensureAtLeast(id: number, n: number): void {
    if (this.count(id) < n) {
      this.counts.set(id, n);
      this.emit();
    }
  }

  onChange(fn: () => void): void {
    this.listeners.push(fn);
  }

  serialize(): Record<number, number> {
    return Object.fromEntries(this.counts);
  }

  load(data: Record<number, number>): void {
    this.counts.clear();
    for (const [id, count] of Object.entries(data)) {
      this.counts.set(Number(id), count);
    }
    this.emit();
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }
}
