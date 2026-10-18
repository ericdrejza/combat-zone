/** Stable priority queue for route searches, avoiding a full sort on every expansion. */
export class EdgeRouteQueue<T> {
  private items: { value: T; order: number }[] = [];
  private nextOrder = 0;

  constructor(private compare: (a: T, b: T) => number) {}

  get size() { return this.items.length; }

  private before(a: typeof this.items[number], b: typeof this.items[number]) {
    const priority = this.compare(a.value, b.value);
    return priority < 0 || (priority === 0 && a.order < b.order);
  }

  push(value: T) {
    const item = { value, order: this.nextOrder++ };
    let index = this.items.length;
    this.items.push(item);
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (!this.before(item, this.items[parent])) break;
      this.items[index] = this.items[parent]; index = parent;
    }
    this.items[index] = item;
  }

  pop(): T | undefined {
    const first = this.items[0], last = this.items.pop();
    if (!first || !last) return undefined;
    if (!this.items.length) return first.value;
    let index = 0;
    while (index * 2 + 1 < this.items.length) {
      let child = index * 2 + 1;
      if (child + 1 < this.items.length && this.before(this.items[child + 1], this.items[child])) child++;
      if (!this.before(this.items[child], last)) break;
      this.items[index] = this.items[child]; index = child;
    }
    this.items[index] = last;
    return first.value;
  }
}
