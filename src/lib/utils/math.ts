export function impliedProbability(odds: number): number {
  if (odds <= 1) return 0;
  return 1 / odds;
}

export function marginFreeProbabilities(odds: Record<string, number>): Record<string, number> {
  const implied = Object.fromEntries(
    Object.entries(odds).map(([k, v]) => [k, impliedProbability(v)])
  );
  const totalMargin = Object.values(implied).reduce((sum, p) => sum + p, 0);
  
  if (totalMargin === 0) return {};
  
  return Object.fromEntries(
    Object.entries(implied).map(([k, v]) => [k, v / totalMargin])
  );
}

export function expectedValue(
  estimatedProb: number,
  odds: number,
  hasPush: boolean = false,
  pushProb: number = 0
): number {
  if (hasPush) {
    const winProb = estimatedProb * (1 - pushProb);
    const lossProb = (1 - estimatedProb) * (1 - pushProb);
    return winProb * (odds - 1) - lossProb;
  }
  return estimatedProb * odds - 1;
}

export function fairOdds(estimatedProb: number, hasPush: boolean = false, pushProb: number = 0): number {
  if (estimatedProb <= 0) return 0;
  if (hasPush) {
    const winProb = estimatedProb * (1 - pushProb);
    return winProb > 0 ? 1 / winProb + 1 : 0;
  }
  return 1 / estimatedProb;
}

export function evPercentage(ev: number): number {
  return ev * 100;
}

export function americanToDecimal(american: number): number {
  if (american > 0) return (american / 100) + 1;
  if (american < 0) return (100 / Math.abs(american)) + 1;
  return 1;
}

export function decimalToAmerican(decimal: number): number {
  if (decimal >= 2) return Math.round((decimal - 1) * 100);
  return Math.round(-100 / (decimal - 1));
}

export function normalizeLine(line: number): number {
  return Math.round(line * 2) / 2;
}

export function selectionsMatch(
  market1: string, line1: number | undefined, sel1: string,
  market2: string, line2: number | undefined, sel2: string
): boolean {
  if (market1 !== market2) return false;
  if (market1 === 'spreads' || market1 === 'totals') {
    if (line1 === undefined || line2 === undefined) return false;
    return normalizeLine(line1) === normalizeLine(line2) && sel1 === sel2;
  }
  return sel1 === sel2;
}