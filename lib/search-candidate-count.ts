type CandidateCountInput = {
  dateFrom: string;
  dateTo: string;
  minNights: number;
  maxNights: number;
};

export function countCandidatePairs(input: CandidateCountInput) {
  const from = Date.parse(`${input.dateFrom}T00:00:00Z`);
  const to = Date.parse(`${input.dateTo}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return 0;
  if (!Number.isInteger(input.minNights) || !Number.isInteger(input.maxNights) || input.minNights < 1 || input.maxNights < input.minNights) return 0;

  const span = Math.round((to - from) / 86_400_000);
  let count = 0;
  for (let departureOffset = 0; departureOffset <= span; departureOffset += 1) {
    const longestTripThatFits = span - departureOffset + 1;
    const lastTripLength = Math.min(input.maxNights, longestTripThatFits);
    if (lastTripLength >= input.minNights) count += lastTripLength - input.minNights + 1;
  }
  return count;
}
