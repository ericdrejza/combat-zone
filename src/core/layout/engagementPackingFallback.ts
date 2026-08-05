import type { EngagementPackingResult } from './engagementPacking';

export type EngagementFallbackLayout =
  | 'growth'
  | 'preserved'
  | 'seed'
  | 'swap';

/** Runs expensive deterministic fallbacks only after regular packing fails. */
export function tryEngagementPackingFallbacks(
  run: (fallback: EngagementFallbackLayout) => EngagementPackingResult,
  runJointTokenSearch: () => EngagementPackingResult,
  failureReason: EngagementPackingResult['failureReason']
): EngagementPackingResult {
  let result = run('preserved');
  if (result.fits) return result;

  result = runJointTokenSearch();
  if (result.fits) return result;

  result = run('growth');
  if (result.fits) return result;

  result = run('swap');
  return !result.fits && failureReason === 'connectors'
    ? { ...result, failureReason }
    : result;
}
