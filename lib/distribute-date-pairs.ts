/** Split a total batch across destinations, giving remainder pairs to earlier rows. */
export function splitDatePairsEvenly(total: number, destinationCount: number) {
  if (!Number.isInteger(total) || total < 0 || !Number.isInteger(destinationCount) || destinationCount < 1) return [];
  const base = Math.floor(total / destinationCount);
  const remainder = total % destinationCount;
  return Array.from({ length: destinationCount }, (_, index) => base + (index < remainder ? 1 : 0));
}

/** Allocate a follow-up total batch to the least-searched destinations first. */
export function allocateDatePairBatch(total: number, checked: number[], candidateCounts: number[]) {
  if (!Number.isInteger(total) || total < 0 || candidateCounts.length === 0) return [];
  const allocation = candidateCounts.map(() => 0);
  for (let remaining = total; remaining > 0;) {
    let bestIndex = -1;
    for (let index = 0; index < candidateCounts.length; index += 1) {
      const current = (checked[index] ?? 0) + allocation[index];
      if (current >= candidateCounts[index]) continue;
      if (bestIndex < 0 || current < (checked[bestIndex] ?? 0) + allocation[bestIndex]) bestIndex = index;
    }
    if (bestIndex < 0) break;
    allocation[bestIndex] += 1;
    remaining -= 1;
  }
  return allocation;
}
