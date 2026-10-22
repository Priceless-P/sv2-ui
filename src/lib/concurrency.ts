/** Bound account fan-out while preserving order and propagating failures. */
export async function mapConcurrent<T, R>(
  values: readonly T[],
  read: (value: T, index: number) => Promise<R>,
  concurrency = 4,
): Promise<R[]> {
  const results: R[] = new Array(values.length);
  let next = 0;
  let failed = false;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (!failed && next < values.length) {
      const index = next++;
      try { results[index] = await read(values[index], index); }
      catch (error) { failed = true; throw error; }
    }
  }));
  return results;
}
